import { Message } from "./Message.model"

/**
 * 服务端 -> 客户端  
 * 数据包基本结构类
 */
export class ServerSocketPacket {
  constructor(
    public readonly cmd: 'AUTH' | 'MESSAGE_REPLY' | 'MESSAGE' | 'INFO' | 'PONG',
    public readonly data: any
  ) { }
}
export class AuthServerSocketPacket extends ServerSocketPacket {
  public readonly data: {
    code: 200 | 401 | 403,
    auth?: string,
    msg: string,
    webpushPublicKey?: string,
    fcmProjectId?: string,
    fcmApplicationId?: string,
    fcmApiKey?: string
  }
  constructor(data: {
    code: 200 | 401 | 403,
    auth?: string,
    msg: string,
    webpushPublicKey?: string,
    fcmProjectId?: string,
    fcmApplicationId?: string,
    fcmApiKey?: string
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
  public readonly data: {
    mid: string,
    status: TypeObject<MessageStatus>
  }
  constructor(mid: string, status: TypeObject<MessageStatus>) {
    super('MESSAGE_REPLY', status)
    this.data = {
      mid,
      status
    }
  }
}
export class InfoServerSocketPacket extends ServerSocketPacket {
  public readonly data: string
  constructor(info: string) {
    super('INFO', info)
    this.data = info
  }
}