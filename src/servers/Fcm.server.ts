import { Context } from "../Context";
import * as WebPush from "web-push"
import { RegisterFcmServerSocketPacket } from "../model/ServerSocketPacket";
import { Client } from "src/model/Client";
import { Message } from "src/model/Message.model";
export class FcmServer {

  /**
   * 保存用户的pushSubscription
   */
  private nameMap: Map<string, {
    group: string,
    pushSubscription: WebPush.PushSubscription
  }> = new Map()
  private vapidKeys: {
    publicKey: string,
    privateKey: string
  }
  constructor(
    private readonly context: Context
  ) {
    if (this.context.config.fcm.serverKey) {
      this.vapidKeys = WebPush.generateVAPIDKeys();
      WebPush.setVapidDetails(
        'mailto:your-email@provider.com',
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey
      )
      WebPush.setGCMAPIKey(this.context.config.fcm.serverKey)
      this.context.ebus.on('register-fcm', (client) => {
        this.registerFcm(client)
      })
      this.context.ebus.on('register-fcm-2', ({ client, pushSubscription }) => {
        this.registerFcm2(client, pushSubscription)
      })
      this.context.ebus.on('message-start', (message) => {
        this.onMessageStart(message)
      })
    }
  }

  /**
   * 注册fcm第一阶段
   * @param client 
   */
  registerFcm(client: Client<Message>) {
    client.sendPacket(new RegisterFcmServerSocketPacket(this.vapidKeys.publicKey))
  }

  registerFcm2(client: Client<Message>, pushSubscription: WebPush.PushSubscription) {
    if (!this.nameMap.has(client.name)) {
      console.log(`[register-FCM]: ${client.name}`)
    }
    this.nameMap.set(client.name, {
      group: client.group,
      pushSubscription
    })
  }

  onMessageStart(message: Message) {
    if (message.sendType === 'personal') {
      const item = this.nameMap.get(message.target)
      if (item) {
        this.sendFCM(item.pushSubscription, message)
      }
    } else if (message.sendType === 'group') {
      this.nameMap.forEach((item) => {
        if (item.group && item.group === message.target) {
          this.sendFCM(item.pushSubscription, message)
        }
      })
    }
  }

  sendFCM(pushSubscription: WebPush.PushSubscription, message: Message) {
    let options = this.context.config.fcm.proxy ? { proxy: this.context.config.fcm.proxy } : undefined
    WebPush.sendNotification(pushSubscription, JSON.stringify(message), options).catch((e) => {
      setTimeout(() => {
        this.sendFCM(pushSubscription, message)
      }, 5000)
    })
  }

}