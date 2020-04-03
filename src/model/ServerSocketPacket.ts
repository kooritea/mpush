import { Message } from "./Message.model"

/**
 * 服务端 -> 客户端  
 * 数据包基本结构类
 */
export class ServerSocketPacket {
  constructor(
    public readonly cmd: 'AUTH' | 'MESSAGE_REPLY' | 'MESSAGE' | 'INFO',
    public readonly data: any
  ) { }
}
export class AuthServerSocketPacket extends ServerSocketPacket {
  public readonly data: {
    code: number,
    msg: string
  }
  constructor(data: {
    code: number,
    msg: string
  }) {
    super('AUTH', data)
    this.data = data
  }
}
export class MessageServerSocketPacket extends ServerSocketPacket {
  public readonly data: Message
  constructor(message: Message) {
    super('MESSAGE', message)
    this.data = message
  }
}
export class MsgReplyServerSocketPacket extends ServerSocketPacket {
  public readonly data: TypeObject<MessageStatus>
  constructor(status: TypeObject<MessageStatus>) {
    super('MESSAGE_REPLY', status)
    this.data = status
  }
}