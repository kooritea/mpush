import * as Http from "http"
import * as Url from "url"
import * as querystring from 'querystring';
import { Context } from "../Context";
import { Message } from "../model/Message.model";
import { ClientSocketPacket, MessageClientSocketPacket, MsgCbClientSocketPacket, MsgWebPushCbClientSocketPacket, AuthClientSocketPacket, RegisterFCMClientSocketPacket } from "../model/ClientSocketPacket";
import * as Utils from '../Utils'
import * as Jsonwebtoken from 'jsonwebtoken'
import { MsgReplyServerSocketPacket, InfoServerSocketPacket, AuthServerSocketPacket } from "../model/ServerSocketPacket";

export class HttpServer {

  private httpServer: Http.Server
  private messageMap: Map<Message, Http.ServerResponse> = new Map()
  constructor(
    private readonly context: Context
  ) {
    this.httpServer = Http.createServer(this.httpHandle.bind(this))
    this.httpServer.listen(this.context.config.http.port)
    this.context.ebus.on('message-end', this.messageEndHandle.bind(this))
    console.log(`[HTTP-Server] Init`)
    console.log(`[HTTP-Server] Listen on ${this.context.config.http.port}`)
  }
  private async httpHandle(request: Http.IncomingMessage, response: Http.ServerResponse) {
    try {
      response.setHeader('content-type', 'application/json; charset=utf-8')
      if (this.context.config.http.cors) {
        response.setHeader('Access-Control-Allow-Origin', request.headers['origin'] || '');
      }
      if (request.method === 'OPTIONS') {
        if (this.context.config.http.cors) {
          response.setHeader('Access-Control-Allow-Headers', request.headers['access-control-request-headers'] || '');
          response.setHeader('Access-Control-Allow-Methods', request.headers['access-control-request-method'] || '');
          response.statusCode = 200
          response.end()
        } else {
          response.statusCode = 403
          response.end()
        }
        return
      }
      this.verifyToken(request)
      if (request.method === 'GET') {
        const { sendType, target } = this.verifyUrl(<string>request.url)
        let payload: {
          text: string,
          desp: string,
          extra: TypeObject<string>
        } = {
          text: '',
          desp: '',
          extra: {}
        }
        payload = this.verifyGet(request)
        const message = new Message({
          sendType,
          target,
          from: {
            method: 'http',
            name: ''
          },
          message: payload
        })
        this.messageMap.set(message, response)
        this.context.ebus.emit('message-start', message)
        setTimeout(() => {
          this.messageEndHandle({
            message,
            status: this.context.messageManager.getMessageStatus(message.mid)
          })
        }, this.context.config.http.waitTimeout)
      } else if (request.method === 'POST') {
        const clientSocketPacket = await this.verifyPost(request)
        switch (clientSocketPacket.cmd) {
          case 'AUTH':
            this.runCmdAuth(clientSocketPacket, response)
            break
          case 'MESSAGE':
            this.runCmdMessage(clientSocketPacket, response)
            break
          case 'MESSAGE_CALLBACK':
            this.runCmdMgsCb(clientSocketPacket, response)
            break
          case 'MESSAGE_WEBPUSH_CALLBACK':
            this.runCmdMgsWebPushCb(clientSocketPacket, response)
            break
          case 'REGISTER_FCM':
            this.runCmdRegisterFCM(clientSocketPacket, response)
            break
          case 'TEST_HTTP':
            this.runCmdTestHttp(response)
            break
          default:
            console.log(`Unknow cmd: ${clientSocketPacket.cmd}`)
            throw new Error(`Unknow cmd: ${clientSocketPacket.cmd}`)
        }
      } else {
        response.statusCode = 405
        response.end()
      }
    } catch (e) {
      console.error(e)
      response.statusCode = 500
      response.end(JSON.stringify(new InfoServerSocketPacket(e.message)))
    }
  }
  private runCmdAuth(clientSocketPacket: ClientSocketPacket, response: Http.ServerResponse) {
    const packet = new AuthClientSocketPacket(clientSocketPacket)
    if (packet.data.token !== this.context.config.token) {
      response.end(JSON.stringify(new AuthServerSocketPacket({
        code: 403,
        msg: 'Token invalid'
      })))
    } else {
      response.end(JSON.stringify(new AuthServerSocketPacket({
        code: 200,
        auth: Jsonwebtoken.sign({
          name: packet.data.name,
          group: packet.data.group
        }, this.context.config.token),
        msg: 'Successful authentication',
        webpushPublicKey: this.context.config.webpush.vapidKeys.publicKey
      })))
    }
  }
  private runCmdMessage(clientSocketPacket: ClientSocketPacket, response: Http.ServerResponse) {
    const packet = new MessageClientSocketPacket(clientSocketPacket)
    const message = new Message({
      sendType: packet.data.sendType,
      target: packet.data.target,
      from: {
        method: 'http',
        name: clientSocketPacket?.auth?.name || '',
      },
      message: packet.data.message
    })
    this.messageMap.set(message, response)
    this.context.ebus.emit('message-start', message)
    setTimeout(() => {
      this.messageEndHandle({
        message,
        status: this.context.messageManager.getMessageStatus(message.mid)
      })
    }, this.context.config.http.waitTimeout)
  }
  /**
   * 消息送达回调
   * @param clientSocketPacket 
   * @param response 
   */
  private runCmdMgsCb(clientSocketPacket: ClientSocketPacket, response: Http.ServerResponse) {
    if (clientSocketPacket.auth) {
      let packet = new MsgCbClientSocketPacket(clientSocketPacket)
      this.context.ebus.emit('message-client-status', {
        mid: packet.data.mid,
        name: clientSocketPacket.auth.name,
        status: 'ok'
      })
      response.end(JSON.stringify(new InfoServerSocketPacket("ok")))
    } else {
      response.end(JSON.stringify(new InfoServerSocketPacket("The MESSAGE_WEBPUSH_CALLBACK cmd must need auth.")))
    }
  }
  /**
   * WEBPUSH送达回调
   * @param clientSocketPacket 
   * @param response 
   */
  private runCmdMgsWebPushCb(clientSocketPacket: ClientSocketPacket, response: Http.ServerResponse) {
    if (clientSocketPacket.auth) {
      let packet = new MsgWebPushCbClientSocketPacket(clientSocketPacket)

      this.context.ebus.emit('message-webpush-callback', {
        mid: packet.data.mid,
        name: clientSocketPacket.auth.name
      })
      response.end(JSON.stringify(new InfoServerSocketPacket("ok")))
    } else {
      response.end(JSON.stringify(new InfoServerSocketPacket("The MESSAGE_CALLBACK cmd must need auth.")))
    }
  }

  private runCmdRegisterFCM(clientSocketPacket: ClientSocketPacket, response: Http.ServerResponse) {
    if (clientSocketPacket.auth) {
      const registerFCMClientSocketPacket = new RegisterFCMClientSocketPacket(clientSocketPacket)
      const client = this.context.clientManager.getClient(registerFCMClientSocketPacket.auth.name)
      if (client) {
        this.context.ebus.emit('register-fcm', {
          client: client,
          token: registerFCMClientSocketPacket.data.token
        })
        response.end(JSON.stringify(new InfoServerSocketPacket("ok")))
      } else {
        response.end(JSON.stringify(new InfoServerSocketPacket(`The Client ${registerFCMClientSocketPacket.auth.name} is not register`)))
      }
    } else {
      response.end(JSON.stringify(new InfoServerSocketPacket("The REGISTER_FCM cmd must need auth.")))
    }
  }

  private runCmdTestHttp(response: Http.ServerResponse) {
    response.statusCode = 200
    response.end()
  }
  private messageEndHandle(payload: {
    message: Message,
    status: TypeObject<MessageStatus>
  }): void {
    try {
      const response = this.messageMap.get(payload.message)
      response?.end(JSON.stringify(new MsgReplyServerSocketPacket(payload.message.mid, payload.status)))
    } catch (e) { }
    this.messageMap.delete(payload.message)
  }
  private verifyToken(request: Http.IncomingMessage): void {
    if (this.context.config.http.verifyToken) {
      if (request.headers['authorization:'] !== this.context.config.token) {
        throw new Error(`Authorization verify error: ${request.headers['authorization']}`)
      }
    }

  }
  private verifyUrl(url: string): {
    sendType: "personal" | "group",
    target: string
  } {
    const pathname = Url.parse(url).pathname || ""
    if (/\/(.*?)\.(send|group)/.test(pathname)) {
      const args = pathname.match(/^\/(.*?)\.(.*?)$/)
      if (args) {
        return {
          sendType: args[2] === 'send' ? 'personal' : 'group',
          target: args[1]
        }
      } else {
        throw new Error(`pathname verify error: ${pathname}`)
      }
    } else {
      throw new Error(`pathname verify error: ${pathname}`)
    }
  }
  private verifyGet(request: Http.IncomingMessage): {
    text: string,
    desp: string,
    extra: TypeObject<string>
  } {
    const { query } = Url.parse(<string>request.url, true)
    let extra = {
      ...<TypeObject<string>>query
    }
    delete extra.text
    delete extra.desp
    return {
      text: String(query.text || "") || "",
      desp: String(query.desp || "") || "",
      extra
    }
  }
  private async verifyPost(request: Http.IncomingMessage): Promise<ClientSocketPacket> {
    const requestBody = await new Promise<string>((resolve, reject) => {
      let raw: string = ''
      request.on('data', (chunk) => {
        raw += chunk
      })
      request.on('end', () => {
        resolve(raw)
      })
    })
    let body = this.bodyparser(request.headers, requestBody)
    return Utils.decodeSocketData(body)
  }
  /**
   * 返回json字符串
   * @param headers 
   * @param raw 
   */
  private bodyparser(headers: Http.IncomingHttpHeaders, raw: string): string {
    let result = ""
    let contentType = headers['content-type']
    try {
      if (/www-form-urlencoded/.test(<string>contentType)) {
        result = JSON.stringify(querystring.parse(raw))
      } else if (/json/.test(<string>contentType)) {
        result = raw
      } else {
        throw new Error(`Unsupported Content Type: ${contentType}`)
      }
    } catch (e) {
      throw new Error(`Unsupported Content Type: ${contentType}`)
    }
    return result
  }
}

class HttpClient {

  constructor() {

  }
}