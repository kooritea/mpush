import { Context } from "src/Context";
import * as Http from "http"
import { Server, MessageEvent, Data as SocketData } from "ws"
import { Message } from "../model/Message.model";
import { ClientSocketPacket, AuthClientSocketPacket, MessageClientSocketPacket, MsgCbClientSocketPacket, RegisterWebPushClientSocketPacket, MsgWebPushCbClientSocketPacket, RegisterFCMClientSocketPacket } from "../model/ClientSocketPacket";
import { MessageServerSocketPacket, AuthServerSocketPacket, ServerSocketPacket, MsgReplyServerSocketPacket, InfoServerSocketPacket } from "../model/ServerSocketPacket";
import * as Utils from "../Utils";
import * as Jsonwebtoken from 'jsonwebtoken'
import { Ebus } from "../Ebus";
import { QueueClient } from "../model/Client";
import { Logger } from "../Logger";
import { WebPushServer } from "./WebPush.server";
import { CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE } from "../Define";
type Socket = MessageEvent['target']

export class WebsocketServer {

  private server: Server
  private logger: Logger = new Logger('WebsocketServer')
  /**
   * 记录发送消息的Client和Message的对应关系  
   * 用于message-end事件订阅中查找消息来源并发送反馈
   */
  private messageMap: Map<Message, {
    client: SocketClient,
    timer: NodeJS.Timeout
  }> = new Map()
  constructor(
    private readonly context: Context,
    httpServer: Http.Server
  ) {
    this.server = this.createServer(httpServer)
    this.context.ebus.on('message-end', ({ message, status }) => {
      this.onMessageEnd(message, status)
    })
    this.logger.info(`Init`)
    this.logger.info(`Listen on ${this.context.config.websocket.port}`)
  }

  private createServer(httpServer: Http.Server): Server {
    let server
    if (this.context.config.websocket.port === this.context.config.http.port) {
      server = new Server({ server: httpServer })
    } else {
      server = new Server({ port: this.context.config.websocket.port })
    }
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
        socket.removeAllListeners()
        socket.close()
      })
      socket.on('error', () => {
        this.logger.error(`${name}`, 'error-close')
        socket.removeAllListeners()
        socket.close()
      })
    })
    return server
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
      if (clientSocketPacket.cmd === 'AUTH') {
        this.runCmdAuth(socket, new AuthClientSocketPacket(clientSocketPacket))
      } else {
        const client = this.context.clientManager.getClient(name, CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE)
        if (client instanceof SocketClient) {
          switch (clientSocketPacket.cmd) {
            case 'MESSAGE':
              this.runCmdMessage(client, name, new MessageClientSocketPacket(clientSocketPacket))
              break
            case 'MESSAGE_CALLBACK':
              this.runCmdMgsCb(client, name, new MsgCbClientSocketPacket(clientSocketPacket))
              break
            case 'REGISTER_WEBPUSH':
              const registerWebPushClientSocketPacket = new RegisterWebPushClientSocketPacket(clientSocketPacket)
              this.context.ebus.emit('register-webpush', {
                client: client,
                pushSubscription: registerWebPushClientSocketPacket.data
              })
              break
            case 'REGISTER_FCM':
              const registerFCMClientSocketPacket = new RegisterFCMClientSocketPacket(clientSocketPacket)
              this.context.ebus.emit('register-fcm', {
                client: client,
                token: registerFCMClientSocketPacket.data.token
              })
              break
            case 'MESSAGE_WEBPUSH_CALLBACK':
              let packet = new MsgWebPushCbClientSocketPacket(clientSocketPacket)
              this.context.ebus.emit('message-webpush-callback', {
                mid: packet.data.mid,
                name: client.name
              })
              break
            case 'PING':
              client.sendPacket(new ServerSocketPacket('PONG', ""))
              break
            case 'UNREGISTER':
              this.context.clientManager.unRegisterClient({ name })
              break
            default:
              // throw new Error(`Unknow cmd: ${clientSocketPacket.cmd}`)
              client.sendPacket(new InfoServerSocketPacket(`Unknow cmd: ${clientSocketPacket.cmd}`))
          }
        }
      }

    } catch (e) {
      this.logger.error(e)
      if (e instanceof ServerSocketPacket) {
        this.sendMsg(socket, e)
      } else {
        this.sendMsg(socket, new InfoServerSocketPacket(e.message))
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
      let client = this.context.clientManager.registerClient(
        new SocketClient(
          socket,
          this.context.config.websocket.retryTimeout,
          this.context.ebus,
          packet.data.name,
          packet.data.group
        ),
        CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE
      )
      client.sendPacket(new AuthServerSocketPacket({
        code: 200,
        auth: Jsonwebtoken.sign({
          name: packet.data.name,
          group: packet.data.group
        }, this.context.config.token),
        msg: 'Successful authentication',
        webpushPublicKey: this.context.localStorageManager.get<{ publicKey: string, privateKey: string }>(WebPushServer.LOCALSTORAGE_SCOPE, 'VAPIDKeys')?.publicKey,
        fcmProjectId: this.context.config.fcm.projectId,
        fcmApplicationId: this.context.config.fcm.applicationId,
        fcmApiKey: this.context.config.fcm.apiKey
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
  private runCmdMgsCb(client: SocketClient, name: string, packet: MsgCbClientSocketPacket) {
    this.context.ebus.emit('message-client-status', {
      mid: packet.data.mid,
      name,
      status: 'ok'
    })
    client.comfirm({ mid: packet.data.mid })
  }

  private sendMsg(socket: Socket, data: ServerSocketPacket) {
    socket.send(Utils.encodeSocketData(data))
  }

}

/**
 * 把socket包装成client  
 * client里面控制消息顺序
 */
class SocketClient extends QueueClient {
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
    this.socket.removeAllListeners()
  }

  protected send(message: Message) {
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

  unRegister() {
    super.unRegister()
    this.close()
  }

}