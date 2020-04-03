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
  ) { }

  /**
   * 发送message  
   * 会进入消息队列排队
   * @param message 
   */
  sendMessage(message: T): void {
    this.messages.push(message)
    this.next()
  }

  /**
   * 上一条消息已送达确认  
   * 移除队列中第一条消息
   */
  comfirm() {
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
   * 队列自动调用  
   * 上一条消息确认或unlock时调用
   * @param message 
   */
  protected abstract send(message: T): void
}

interface ClientImp<T> {
  send(message: T): void
}