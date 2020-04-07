import { ServerSocketPacket } from "./ServerSocketPacket"

/**
 * 附带消息队列和重试机制的客户端基类  
 * 推送方式由子类实现
 */
export abstract class Client<T> {
  private readonly messages: T[] = []
  private lock: boolean = false
  private timer: NodeJS.Timeout
  /**
   * 
   * @param retryTimeout 重试等待时间,-1时不重试
   */
  constructor(
    private retryTimeout: number,
    public readonly name: string,
    public readonly group: string
  ) { }

  /**
   * 发送message  
   * 会进入消息队列排队  
   * 只有有回复的消息类型才可以进入队列发送,否则没有人调用comfirm
   * @param message 
   */
  sendMessage(message: T): void {
    this.messages.push(message)
    this.next()
  }

  /**
   * 上一条消息已送达确认  
   * 传入上一条消息的唯一键值,只有传入的键值对应当前正在发送的消息才会进行实际的comfirm操作  
   * 移除队列中第一条消息  
   */
  comfirm(keys: Partial<T>) {
    for (let key in keys) {
      if (this.messages[0][key] !== keys[key]) {
        return
      }
    }
    this.messages.shift()
    this.unlock()
  }

  /**
   * 解除锁定并尝试发送队列中第一条消息
   */
  protected unlock() {
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
   * 上一条消息确认或unlock时调用  
   * 当retryTimeout内没有comfirm会重新调用该方法
   * @param message 
   */
  protected abstract send(message: T): void

  /**
   * 直接发送数据包,忽略队列
   * @param packet 
   */
  public abstract sendPacket(packet: ServerSocketPacket): any
}

interface ClientImp<T> {
  send(message: T): void
}