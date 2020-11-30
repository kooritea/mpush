import { HttpServer } from './servers/Http.server'
import { WebsocketServer } from './servers/Websocket.server'
import { WebhookServer } from './servers/Webhook.server'
import { Context } from './Context'
import { WebPushServer } from './servers/WebPush.server'
import { FCMServer } from './servers/FCM.server'
import { Logger } from './Logger'

export class App {

  private readonly context: Context = new Context()
  private httpServer: HttpServer
  private websocketServer: WebsocketServer
  private webhookServer: WebhookServer
  private webpushServer: WebPushServer
  private fcmServer: FCMServer
  private logger: Logger = new Logger('App')
  constructor() {
    this.httpServer = new HttpServer(this.context)
    this.websocketServer = new WebsocketServer(this.context, this.httpServer.httpServer)
    this.webhookServer = new WebhookServer(this.context)
    this.webpushServer = new WebPushServer(this.context)
    this.fcmServer = new FCMServer(this.context)
    process.on("SIGINT", (code) => {
      this.logger.info("exit:等待持久化客户端信息")
      setTimeout(() => {
        this.logger.info("持久化超时，退出")
        process.exit(0)
      }, 120000)
      this.context.clientManager.clientLocalSave(true)
      this.context.messageManager.messageLocalSave(true)
      process.exit(0)

    });
  }
}