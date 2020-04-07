import { Context } from "../Context";
import * as WebPush from "web-push"
import { RegisterFcmServerSocketPacket, ServerSocketPacket, MessageServerSocketPacket } from "../model/ServerSocketPacket";
import { Client } from "../model/Client";
import { Message } from "../model/Message.model";
export class FcmServer {

  private nameMap: Map<string, FcmClient> = new Map()
  private options: WebPush.RequestOptions | undefined = this.context.config.fcm.proxy ? { proxy: this.context.config.fcm.proxy } : undefined
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
        'mailto:your-email@gmail.com',
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
      this.context.ebus.on('message-client-status', ({ name, mid, status }) => {
        this.onMessageClientStatus(name, mid, status)
      })
      this.context.ebus.on('message-fcm-callback', ({ mid, name }) => {
        this.onMessageCallback(mid, name)
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
    this.nameMap.set(client.name, new FcmClient(
      pushSubscription,
      this.context.config.fcm.retryTimeout,
      client.name,
      client.group,
      this.options
    ))
  }

  onMessageStart(message: Message) {
    if (message.sendType === 'personal') {
      const fcmClient = this.nameMap.get(message.target)
      if (fcmClient) {
        // fcmClient.sendMessage(message)
        fcmClient.sendPacket(new MessageServerSocketPacket(message))
      }
    } else if (message.sendType === 'group') {
      this.nameMap.forEach((fcmClient) => {
        if (fcmClient.group && fcmClient.group === message.target) {
          // fcmClient.sendMessage(message)
          fcmClient.sendPacket(new MessageServerSocketPacket(message))
        }
      })
    }
  }

  /**
   * 判断该message是否有通过FcmClient发送  
   * 如是且状态为ok,则调用fcmClient.comfirm
   * @param message 
   * @param status 
   */
  private onMessageClientStatus(name: string, mid: string, status: MessageStatus): void {
    if (status === 'ok') {
      let fcmClient = this.nameMap.get(name)
      if (fcmClient) {
        console.log(`[FCM client comfirm]: ${name}`)
        fcmClient.comfirm()
      }
    }
  }
  onMessageCallback(mid: string, name: string) {
    let fcmClient = this.nameMap.get(name)
    if (fcmClient) {
      console.log(`[FCM client comfirm]: ${name}`)
      fcmClient.comfirm()
    }
  }

}

class FcmClient extends Client<Message> {
  private sendPacketLock: boolean = false
  constructor(
    private pushSubscription: WebPush.PushSubscription,
    retryTimeout: number,
    name: string,
    group: string,
    private options?: WebPush.RequestOptions
  ) {
    super(retryTimeout, name, group)
  }
  send(message: Message) {
    console.log(`[FCM loop send]: ${message.message.text}`)
    let data = new MessageServerSocketPacket(message)
    this.sendPacket(data)
  }
  sendPacket(packet: ServerSocketPacket) {
    // if (!this.sendPacketLock) {
    //   console.log(`[FCM send]: ${packet.data.message.text}`)
    //   WebPush.sendNotification(this.pushSubscription, JSON.stringify(packet), this.options).catch((e) => {
    //     console.log(`[FCM Error]: ${e.message}`)
    //   }).finally(() => {
    //     this.sendPacketLock = true
    //   })
    // }
    WebPush.sendNotification(this.pushSubscription, JSON.stringify(packet), this.options).catch((e) => {
      console.log(`[FCM Error]: ${e.message}`)
    })
  }
}