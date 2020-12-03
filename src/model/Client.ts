import { ServerSocketPacket } from "./ServerSocketPacket"
import { Message } from "./Message.model"

/**
 * 附带消息队列和重试机制的客户端基类  
 * 推送方式由子类实现
 * 只有像websocket和webhook这种有有接收信息能力的client才会包装成Client类
 */
export class Client {
  protected readonly messages: Message[] = []
  private clientScope: string
  constructor(
    public readonly name: string,
    public readonly group: string
  ) { }

  /**
   * message进入消息队列排队  
   * @param message 
   */
  public sendMessage(message: Message): void {
    this.messages.push(message)
  }

  /**
   * 上一条消息已送达确认  
   * 传入上一条消息的唯一键值,只有传入的键值对应当前正在发送的消息才会进行实际的comfirm操作  
   * 移除队列中第一条消息  
   */
  public comfirm(keys: Partial<Message>) {
    for (let key in keys) {
      if (!this.messages[0] || this.messages[0][key] !== keys[key]) {
        return
      }
    }
    this.messages.shift()
  }

  /**
   * 从队列中删除一条消息
   * @param keys 
   */
  public deleteMessage(keys: Partial<Message>): void {
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i]
      let next = false
      for (let key in keys) {
        if (message[key] !== keys[key]) {
          next = true
        }
      }
      if (next) {
        continue
      }
      this.messages.splice(i, 1)
      return
    }
  }

  /**
   * 注销客户端  
   * 重写时必须调用super.unRegister()  
   * 清空消息队列，关闭计时器  
   */
  public unRegister(): void {
    while (this.messages.length > 0) {
      this.messages.pop()
    }
  }
  public exportMessages(): Message[] {
    return this.messages
  }

  /**
   * 继承后自动注销传入的client
  */
  public inherit(client: Client): void {
    for (let message of client.exportMessages()) {
      this.sendMessage(message)
    }
    client.unRegister()
  }

  /**
 * 直接发送数据包,忽略队列
 * @param packet 
 */
  public sendPacket(packet: ServerSocketPacket): any { }

  public setClientScope(name: string): void {
    this.clientScope = name
  }
  public getClientScope(): string {
    return this.clientScope
  }
}


export abstract class QueueClient extends Client {

  private lock: boolean = false
  private timer: NodeJS.Timeout

  constructor(
    private retryTimeout: number,
    public readonly name: string,
    public readonly group: string
  ) {
    super(name, group)
  }

  /**
   * 发送message  
   * 会进入消息队列排队  
   * 只有有回复的消息类型才可以进入队列发送,否则没有人调用comfirm
   * @param message 
   */
  public sendMessage(message: Message): void {
    super.sendMessage(message)
    this.next()
  }

  /**
   * 上一条消息已送达确认  
   * 传入上一条消息的唯一键值,只有传入的键值对应当前正在发送的消息才会进行实际的comfirm操作  
   * 移除队列中第一条消息  
   */
  public comfirm(keys: Partial<Message>) {
    super.comfirm(keys)
    this.unlock()
  }

  /**
   * 解除锁定并尝试发送队列中第一条消息
   */
  private unlock() {
    clearTimeout(this.timer)
    this.lock = false
    this.next()
  }

  private next() {
    const message = this.messages[0]
    if (message && !this.lock) {
      this.lock = true
      if (this.retryTimeout > -1) {
        this.timer = setTimeout(() => {
          this.lock = false
          this.next()
        }, this.retryTimeout)
      }
      this.send(message)
    }
  }

  /**
   * 马上重试,重新计时
   */
  protected retrySend() {
    clearTimeout(this.timer)
    this.lock = false
    this.next()
  }

  /**
   * 队列自动调用  
   * 上一条消息确认时调用  
   * 当retryTimeout内没有comfirm会重新调用该方法
   * @param message 
   */
  protected abstract send(message: Message): void

  /**
   * 直接发送数据包,忽略队列
   * @param packet 
   */
  public abstract sendPacket(packet: ServerSocketPacket): any

  /**
   * 注销客户端  
   * 重写时必须调用super.unRegister()  
   * 清空消息队列，关闭计时器  
   */
  public unRegister(): void {
    super.unRegister()
    clearTimeout(this.timer)
  }
}