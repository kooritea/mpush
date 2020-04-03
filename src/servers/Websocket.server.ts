import { Context } from "src/Context";
import { Server, MessageEvent, Data as SocketData } from "ws"
import { Message } from "../model/Message.model";
import { ClientSocketPacket, AuthClientSocketPacket, MessageClientSocketPacket, MgsCbClientSocketPacket } from "../model/ClientSocketPacket";
import { MessageServerSocketPacket, AuthServerSocketPacket, ServerSocketPacket, MsgReplyServerSocketPacket } from "../model/ServerSocketPacket";
import * as Utils from "../Utils";
import { Ebus } from "../Ebus";
type Socket = MessageEvent['target']

export class WebsocketServer {

  private server: Server
  private nameMap: Map<string, {
    client: Client,
    group: string
  }> = new Map()
  /**
   * 记录发送消息的Client和Message的对应关系  
   * 用于message-end事件订阅中查找消息来源并发送反馈
   */
  private messageMap: Map<Message, Client> = new Map()
  constructor(
    private readonly context: Context
  ) {
    this.server = this.createServer()
    this.context.ebus.on('message-start', (message) => {
      this.onMessageStart(message)
    })
    this.context.ebus.on('message-end', ({ message, status }) => {
      this.onMessageEnd(message, status)
    })
  }

  private createServer(): Server {
    const server = new Server({ port: this.context.config.websocket.port })
    server.on('connection', (socket) => {
      let name: string = ""
      let timer = setTimeout(() => {
        socket.close()
      }, this.context.config.websocket.authTimeout);
      socket.onmessage = (event: MessageEvent) => {
        this.onmessage(event.target, event.data, name)
      }
      socket.on('auth-success', (event: AuthClientSocketPacket['data']) => {
        // socket认证成功后,event是认证的name
        name = event.name
        clearInterval(timer)
        this.context.ebus.emit('user-register', {
          name: event.name,
          group: event.group
        })
      })
      socket.on('ping', () => {
        socket.pong()
      })
      socket.on('close', () => {
        console.log(`[${name}]: close`)
        socket.removeAllListeners()
        socket.close()
      })
      socket.on('error', () => {
        console.log(`[${name}]: error`)
        socket.removeAllListeners()
        socket.close()
      })
    })
    return server
  }

  /**
   * 判断该消息的目标是否是通过websocket接入  
   * 如是则推送消息
   * @param message 
   */
  private onMessageStart(message: Message): void {
    if (message.sendType === 'personal') {
      const client = this.nameMap.get(message.target)?.client
      if (client) {
        client.sendMessage(message)
      }
    } else if (message.sendType === 'group') {
      this.nameMap.forEach((item) => {
        if (item.group === message.target) {
          item.client.sendMessage(message)
        }
      })
    }
  }

  /**
   * 判断该message是否由socket客户端发出  
   * 如是则发送message接收状态
   * @param message 
   * @param status 
   */
  private onMessageEnd(message: Message, status: TypeObject<MessageStatus>): void {
    const client = this.messageMap.get(message)
    if (client) {
      client.sendPacket(new MsgReplyServerSocketPacket(status))
    }
  }

  /**
   * socket消息处理器
   * @param socket 
   * @param data 
   * @param name 
   */
  private onmessage(socket: Socket, data: SocketData, name: string) {
    try {
      const clientSocketPacket: ClientSocketPacket = Utils.decodeSocketData(data)
      if (name === '' && clientSocketPacket.cmd !== 'AUTH') {
        throw new AuthServerSocketPacket({
          code: 401,
          msg: 'Need Auth'
        })
      }
      const client = this.nameMap.get(name)?.client
      switch (clientSocketPacket.cmd) {
        case 'AUTH':
          this.runCmdAuth(socket, new AuthClientSocketPacket(clientSocketPacket))
          break
        case 'MESSAGE':
          this.runCmdMessage(<Client>client, name, new MessageClientSocketPacket(clientSocketPacket))
          break
        case 'MESSAGE_CALLBACK':
          this.runCmdMgsCb(<Client>client, name, new MgsCbClientSocketPacket(clientSocketPacket))
          break
        default:
          throw new Error(`Unknow cmd: ${clientSocketPacket.cmd}`)
      }
    } catch (e) {
      console.error(e)
      if (e instanceof ServerSocketPacket) {
        this.sendMsg(socket, e)
      } else {
        this.sendMsg(socket, new ServerSocketPacket('INFO', e.message))
      }
    }
  }

  private runCmdAuth(socket: Socket, packet: AuthClientSocketPacket) {
    if (packet.data.token !== this.context.config.token && this.context.config.websocket.verifyToken) {
      throw new AuthServerSocketPacket({
        code: 403,
        msg: 'Token invalid'
      })
    } else if (packet.data.name === '') {
      throw new AuthServerSocketPacket({
        code: 403,
        msg: 'name is required'
      })
    } else {
      let client = this.nameMap.get(packet.data.name)?.client
      if (client) {
        client.updateSocket(socket)
      } else {
        client = new Client(
          socket,
          this.context.config.websocket.retryTimeout,
          this.context.ebus,
          packet.data.name
        )
      }
      this.nameMap.set(packet.data.name, {
        client,
        group: packet.data.group
      })
      this.sendMsg(socket, new AuthServerSocketPacket({
        code: 200,
        msg: 'Successful authentication'
      }))
      socket.emit('auth-success', packet.data)
    }
  }
  private runCmdMessage(client: Client, name: string, packet: MessageClientSocketPacket) {
    const message = new Message({
      sendType: packet.data.sendType,
      target: packet.data.target,
      from: {
        method: 'websocket',
        name,
      },
      message: packet.data.message
    })
    this.messageMap.set(message, client)
    this.context.ebus.emit('message-start', message)
  }
  private runCmdMgsCb(client: Client, name: string, packet: MgsCbClientSocketPacket) {
    this.context.ebus.emit('message-client-status', {
      mid: packet.data.mid,
      name,
      status: 'ok'
    })
    client.comfirm()
  }

  private sendMsg(socket: Socket, data: ServerSocketPacket) {
    socket.send(Utils.encodeSocketData(data))
  }

}

/**
 * 把socket包装成client  
 * client里面控制消息顺序
 */
class Client {
  private readonly messages: Message[] = []
  private lock: boolean = false
  private timer: NodeJS.Timeout
  constructor(
    private socket: Socket,
    private retryTimeout: number,
    private ebus: Ebus,
    private name: string
  ) {
  }

  close() {
    this.socket.close()
  }
  updateSocket(socket: Socket) {
    this.socket = socket
    this.lock = false
    this.next()
  }
  /**
   * 发送message  
   * 会进入消息队列排队
   * @param message 
   */
  sendMessage(message: Message): void {
    this.messages.push(message)
    this.next()
  }

  /**
   * 上一条消息已送达确认
   */
  comfirm() {
    this.messages.shift()
    this.lock = false
    this.next()
  }
  private next() {
    let message = this.messages[0]
    if (message && !this.lock) {
      this.lock = true
      if (this.retryTimeout > -1) {
        this.timer = setTimeout(() => {
          this.lock = false
          this.next()
        }, this.retryTimeout)
      }
      let data = new MessageServerSocketPacket(message)
      this.ebus.emit('message-client-status', {
        mid: message.mid,
        name: this.name,
        status: 'wait'
      })
      this.sendPacket(data)
    }
  }
  /**
   * 直接发送数据包
   * @param packet 
   */
  sendPacket(packet: ServerSocketPacket) {
    this.socket.send(Utils.encodeSocketData(packet))
  }
}