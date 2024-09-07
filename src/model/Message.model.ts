export class Message {
  public readonly sendType: "personal" | "group"
  public readonly target: string
  public readonly from: {
    method: 'http' | 'websocket',
    name: string
  }
  public readonly mid: string
  public readonly message: {
    text: string,
    desp: string,
    extra: {
      [key: string]: string
    }
  }

  constructor(info: {
    sendType: "personal" | "group",
    target: string,
    from: {
      method: 'http' | 'websocket',
      name: string
    },
    message: {
      text: string,
      desp: string,
      extra: TypeObject<string>
    }
  }) {
    this.sendType = info.sendType
    this.target = info.target
    this.from = info.from
    this.message = info.message
    this.mid = String((new Date()).valueOf())
  }
}