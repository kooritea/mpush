/**
 * 客户端 -> 服务端  
 * 数据包基本结构类
 */
export class ClientSocketPacket {
  public readonly cmd: 'AUTH' | 'MESSAGE_CALLBACK' | 'MESSAGE' | 'REGISTER_FCM' | 'REGISTER_FCM_2'
  public readonly data: any

  constructor(json: any) {
    try {
      this.cmd = json.cmd
      this.data = json.data
    } catch (e) {
      throw new Error(`parse ClientSocketPacket error: ${e.message}`)
    }
  }
}
export class AuthClientSocketPacket extends ClientSocketPacket {
  public readonly data: {
    token: string,
    name: string,
    group: string
  }
  constructor(packet: ClientSocketPacket) {
    super(packet)
    this.data = {
      token: String(packet.data.token || ""),
      name: String(packet.data.name || ""),
      group: String(packet.data.group || "")
    }
    if (!this.data.name) {
      throw new Error("name property is required")
    }
  }
}
export class MessageClientSocketPacket extends ClientSocketPacket {
  public readonly data: {
    sendType: "personal" | "group",
    target: string,
    message: {
      text: string,
      desp: string,
      extra: {}
    }
  }
  constructor(packet: ClientSocketPacket) {
    super(packet)
    this.data = {
      sendType: packet.data.sendType === 'personal' ? 'personal' : 'group',
      target: packet.data.target,
      message: {
        text: String(packet.data.message.text || ""),
        desp: String(packet.data.message.desp || ""),
        extra: packet.data.message.extra || {}
      }
    }
    if (!this.data.target) {
      throw new Error("target property is required")
    }
    if (packet.data.sendType !== 'personal' && packet.data.sendType !== 'group') {
      throw new Error("sendType property must 'personal' or 'group'")
    }
  }
}
export class MgsCbClientSocketPacket extends ClientSocketPacket {
  public readonly data: {
    mid: string
  }
  constructor(packet: ClientSocketPacket) {
    super(packet)
    this.data = {
      mid: String(packet.data.mid || "")
    }
    if (!this.data.mid) {
      throw new Error("mid property is required")
    }
  }
}

