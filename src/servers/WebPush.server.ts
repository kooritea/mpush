import { Context } from "../Context";
import * as WebPush from "web-push"
import { ServerSocketPacket, MessageServerSocketPacket, InfoServerSocketPacket } from "../model/ServerSocketPacket";
import { Client } from "../model/Client";
import { Message } from "../model/Message.model";
import { Ebus } from "../Ebus";
import { Logger } from "../Logger";
export class WebPushServer {

  public static LOCALSTORAGE_SCOPE: string = 'WebPushServer'

  private nameMap: Map<string, WebPushClient> = new Map()
  private options: WebPush.RequestOptions | undefined = this.context.config.webpush.proxy ? { proxy: this.context.config.webpush.proxy } : undefined
  private logger: Logger = new Logger('WebPushServer')
  constructor(
    private readonly context: Context
  ) {
    if (this.context.config.webpush.apiKey) {
      const { publicKey, privateKey } = this.getVAPIDKeys()
      WebPush.setVapidDetails(
        'mailto:your-email@gmail.com',
        publicKey,
        privateKey
      )
      WebPush.setGCMAPIKey(this.context.config.webpush.apiKey)
      this.context.ebus.on('register-webpush', ({ client, pushSubscription }) => {
        this.registerWebPush(client, pushSubscription)
      })
      this.context.ebus.on('message-start', (message) => {
        this.onMessageStart(message)
      })
      this.context.ebus.on('message-client-status', ({ name, mid, status }) => {
        this.onMessageClientStatus(name, mid, status)
      })
      this.logger.info(`Init`)
      this.context.ebus.on('message-webpush-callback', ({ mid, name }) => {
        this.onMessageWebPushCallback(mid, name)
      })
      this.context.ebus.on('unregister-client', ({ client }) => {
        this.nameMap.delete(client.name)
      })
    } else {
      this.context.ebus.on('register-webpush', ({ client }) => {
        client.sendPacket(new InfoServerSocketPacket("服务端未提供webpush.apiKey"))
      })
    }
  }

  private getVAPIDKeys(): {
    publicKey: string,
    privateKey: string
  } {
    return this.context.localStorageManager.get(WebPushServer.LOCALSTORAGE_SCOPE, 'VAPIDKeys', WebPush.generateVAPIDKeys(), true)
  }

  registerWebPush(client: Client, pushSubscription: WebPush.PushSubscription) {
    const newInstance = new WebPushClient(
      pushSubscription,
      this.context.config.webpush.retryTimeout,
      client.name,
      client.group,
      this.context.ebus,
      this.logger,
      this.options
    )
    const oldInstance = this.nameMap.get(client.name)
    if (oldInstance) {
      this.logger.info(`${client.name}`, 'register-WebPush-update')
      newInstance.inherit(oldInstance)
      this.nameMap.set(client.name, newInstance)
    } else {
      this.logger.info(`${client.name}`, 'register-WebPush')
      this.nameMap.set(client.name, newInstance)
    }
  }

  onMessageStart(message: Message) {
    if (message.sendType === 'personal') {
      const webpushClient = this.nameMap.get(message.target)
      if (webpushClient) {
        webpushClient.sendMessage(message)
        // this.context.ebus.emit('message-client-status', {
        //   mid: message.mid,
        //   name: webpushClient.name,
        //   status: 'webpush-wait'
        // })
        // webpushClient.sendPacket(new MessageServerSocketPacket(message)).then(() => {
        //   this.context.ebus.emit('message-client-status', {
        //     mid: message.mid,
        //     name: webpushClient.name,
        //     status: 'webpush'
        //   })
        // }).catch((e) => {
        //   console.log(`[WebPush Error]: ${e.message}`)
        // })
      }
    } else if (message.sendType === 'group') {
      this.nameMap.forEach((webpushClient) => {
        if (webpushClient.group && webpushClient.group === message.target) {
          webpushClient.sendMessage(message)
          // this.context.ebus.emit('message-client-status', {
          //   mid: message.mid,
          //   name: webpushClient.name,
          //   status: 'webpush-wait'
          // })
          // webpushClient.sendPacket(new MessageServerSocketPacket(message)).then(() => {
          //   this.context.ebus.emit('message-client-status', {
          //     mid: message.mid,
          //     name: webpushClient.name,
          //     status: 'webpush'
          //   })
          // }).catch((e) => {
          //   console.log(`[WebPush Error]: ${e.message}`)
          // })
        }
      })
    }
  }

  /**
   * 判断该message是否有通过WebPushClient发送  
   * 如是且状态为ok,则调用webpushClient.comfirm
   * @param message 
   * @param status 
   */
  private onMessageClientStatus(name: string, mid: string, status: MessageStatus): void {
    if (status === 'ok') {
      let webpushClient = this.nameMap.get(name)
      if (webpushClient) {
        this.logger.info(`${name}`, 'message-status-change')
        webpushClient.comfirm({ mid })
      }
    }
  }
  /**
   * WebPush送达回调指令事件
   * @param mid 
   * @param name 
   */
  onMessageWebPushCallback(mid: string, name: string) {
    let webpushClient = this.nameMap.get(name)
    if (webpushClient) {
      this.logger.info(`${name}`, 'message-webpush-callback')
      this.context.ebus.emit('message-client-status', {
        mid,
        name,
        status: 'webpush-ok'
      })
    }
  }
}

class WebPushClient extends Client {
  private sendPacketLock: boolean = false
  constructor(
    public pushSubscription: WebPush.PushSubscription,
    retryTimeout: number,
    name: string,
    group: string,
    private ebus: Ebus,
    private logger: Logger,
    private options?: WebPush.RequestOptions,
  ) {
    super(retryTimeout, name, group)
  }
  protected send(message: Message) {
    if (!this.sendPacketLock) {
      this.sendPacketLock = true
      this.logger.info(`${message.message.text}`, 'loop-send')
      this.ebus.emit('message-client-status', {
        mid: message.mid,
        name: this.name,
        status: 'webpush-wait'
      })

      let packet = new MessageServerSocketPacket(message)
      this.sendPacket(packet).then(() => {
        this.ebus.emit('message-client-status', {
          mid: packet.data.mid,
          name: this.name,
          status: 'webpush-send'
        })
        this.comfirm({ mid: packet.data.mid })
      }).catch((e) => {
        this.logger.error(`${e.message}`, 'send-error')
      }).finally(() => {
        this.sendPacketLock = false
      })
    }

  }
  sendPacket(packet: ServerSocketPacket): Promise<WebPush.SendResult> {
    return WebPush.sendNotification(this.pushSubscription, JSON.stringify(packet), {
      headers: {
        "Urgency": 'high'
      },
      ...this.options
    })
  }

  update(pushSubscription: WebPush.PushSubscription) {
    this.pushSubscription = pushSubscription
  }
}