import { Context } from "src/Context";
import { Server, MessageEvent, Data as SocketData } from "ws"
import { Message } from "../model/Message.model";
import { ClientSocketPacket, AuthClientSocketPacket, MessageClientSocketPacket, MgsCbClientSocketPacket } from "../model/ClientSocketPacket";
import { MessageServerSocketPacket, AuthServerSocketPacket, ServerSocketPacket, MsgReplyServerSocketPacket } from "../model/ServerSocketPacket";
import * as Utils from "../Utils";
import * as Jsonwebtoken from 'jsonwebtoken'
import { Ebus } from "../Ebus";
import { Client } from "../model/Client";
type Socket = MessageEvent['target']

export class WebsocketServer {

  private server: Server
  private nameMap: Map<string, SocketClient> = new Map()
  /**
   * 记录发送消息的Client和Message的对应关系  
   * 用于message-end事件订阅中查找消息来源并发送反馈
   */
  private messageMap: Map<Message, {
    client: SocketClient,
    timer: NodeJS.Timeout
  }> = new Map()
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
        this.onSocketMessage(event.target, event.data, name)
      }
      socket.on('auth-success', (event: AuthClientSocketPacket['data']) => {
        // socket认证成功后,event是认证的name
        name = event.name
        clearTimeout(timer)
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
      const client = this.nameMap.get(message.target)
      if (client) {
        client.sendMessage(message)
      }
    } else if (message.sendType === 'group') {
      this.nameMap.forEach((item) => {
        if (item.group && item.group === message.target) {
          item.sendMessage(message)
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
      client.client.sendPacket(new MsgReplyServerSocketPacket(message.mid, status))
    }
    this.messageMap.delete(message)
  }

  /**
   * socket消息处理器
   * @param socket 
   * @param data 
   * @param name 
   */
  private onSocketMessage(socket: Socket, data: SocketData, name: string) {
    try {
      const clientSocketPacket: ClientSocketPacket = Utils.decodeSocketData(data)
      if (name === '' && clientSocketPacket.cmd !== 'AUTH') {
        throw new AuthServerSocketPacket({
          code: 401,
          msg: 'Need Auth'
        })
      }
      const client = this.nameMap.get(name)
      switch (clientSocketPacket.cmd) {
        case 'AUTH':
          this.runCmdAuth(socket, new AuthClientSocketPacket(clientSocketPacket))
          break
        case 'MESSAGE':
          this.runCmdMessage(<SocketClient>client, name, new MessageClientSocketPacket(clientSocketPacket))
          break
        case 'MESSAGE_CALLBACK':
          this.runCmdMgsCb(<SocketClient>client, name, new MgsCbClientSocketPacket(clientSocketPacket))
          break
        case 'REGISTER_FCM':
          this.context.ebus.emit('register-fcm', <SocketClient>client)
          break
        case 'REGISTER_FCM_2':
          this.context.ebus.emit('register-fcm-2', {
            client: <SocketClient>client,
            pushSubscription: clientSocketPacket.data
          })
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
    } else {
      let client = this.nameMap.get(packet.data.name)
      if (client) {
        client.updateSocket(socket)
      } else {
        this.context.messageManager.registerUser(
          packet.data.name,
          packet.data.group
        )
        client = new SocketClient(
          socket,
          this.context.config.websocket.retryTimeout,
          this.context.ebus,
          packet.data.name,
          packet.data.group
        )
      }
      this.nameMap.set(packet.data.name, client)
      this.sendMsg(socket, new AuthServerSocketPacket({
        code: 200,
        auth: Jsonwebtoken.sign({
          name: packet.data.name,
          group: packet.data.group
        }, this.context.config.token),
        msg: 'Successful authentication'
      }))
      socket.emit('auth-success', packet.data)
    }
  }
  private runCmdMessage(client: SocketClient, name: string, packet: MessageClientSocketPacket) {
    const message = new Message({
      sendType: packet.data.sendType,
      target: packet.data.target,
      from: {
        method: 'websocket',
        name,
      },
      message: packet.data.message
    })
    this.messageMap.set(message, {
      client: client,
      timer: setTimeout(() => {
        this.onMessageEnd(
          message,
          this.context.messageManager.getMessageStatus(message.mid)
        )
      }, this.context.config.websocket.waitTimeout)
    })
    this.context.ebus.emit('message-start', message)
  }
  private runCmdMgsCb(client: SocketClient, name: string, packet: MgsCbClientSocketPacket) {
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
class SocketClient extends Client<Message> {
  constructor(
    private socket: Socket,
    retryTimeout: number,
    private ebus: Ebus,
    name: string,
    group: string
  ) {
    super(retryTimeout, name, group)
  }

  close() {
    this.socket.close()
  }
  updateSocket(socket: Socket) {
    this.socket = socket
    this.unlock()
  }

  send(message: Message) {
    let data = new MessageServerSocketPacket(message)
    this.ebus.emit('message-client-status', {
      mid: message.mid,
      name: this.name,
      status: 'wait'
    })
    this.sendPacket(data)
  }
  sendPacket(packet: ServerSocketPacket) {
    this.socket.send(Utils.encodeSocketData(packet))
  }
}