import { Context } from "../Context";
import * as WebPush from "web-push"
import { ServerSocketPacket, MessageServerSocketPacket, InfoServerSocketPacket } from "../model/ServerSocketPacket";
import { Client } from "../model/Client";
import { Message } from "../model/Message.model";
import { Ebus } from "../Ebus";
import * as FS from "fs"
import * as Path from "path"


export class FcmServer {

  private nameMap: Map<string, FcmClient> = new Map()
  private options: WebPush.RequestOptions | undefined = this.context.config.fcm.proxy ? { proxy: this.context.config.fcm.proxy } : undefined

  constructor(
    private readonly context: Context
  ) {
    if (this.context.config.fcm.serverKey) {
      const { publicKey, privateKey } = this.getVAPIDKeys()
      WebPush.setVapidDetails(
        'mailto:your-email@gmail.com',
        publicKey,
        privateKey
      )
      WebPush.setGCMAPIKey(this.context.config.fcm.serverKey)
      this.context.ebus.on('register-fcm', ({ client, pushSubscription }) => {
        this.registerFcm(client, pushSubscription)
      })
      this.context.ebus.on('message-start', (message) => {
        this.onMessageStart(message)
      })
      this.context.ebus.on('message-client-status', ({ name, mid, status }) => {
        this.onMessageClientStatus(name, mid, status)
      })
      console.log(`[FCM-Server] Init`)
      this.context.ebus.on('message-fcm-callback', ({ mid, name }) => {
        this.onMessageFcmCallback(mid, name)
      })
    } else {
      this.context.ebus.on('register-fcm', ({ client }) => {
        client.sendPacket(new InfoServerSocketPacket("服务端未提供fcm.serverKey"))
      })
    }
  }

  getVAPIDKeys() {
    const keypath = Path.resolve('./keys')
    try {
      const keys = JSON.parse(FS.readFileSync(keypath).toString())
      return keys
    } catch (e) {
      console.warn(`读取本地FCM秘钥对失败，重新生成到${keypath}`)
      const keys = WebPush.generateVAPIDKeys()
      try {
        FS.writeFileSync(keypath, JSON.stringify(keys))
      } catch (e) {
        console.warn(`保存FCM秘钥对到${keypath}失败，下次启动将重新生成`)
      }
      return keys
    }

  }

  registerFcm(client: Client, pushSubscription: WebPush.PushSubscription) {
    if (!this.nameMap.has(client.name)) {
      console.log(`[register-FCM]: ${client.name}`)
    }
    this.nameMap.set(client.name, new FcmClient(
      pushSubscription,
      this.context.config.fcm.retryTimeout,
      client.name,
      client.group,
      this.context.ebus,
      this.options
    ))
  }

  onMessageStart(message: Message) {
    if (message.sendType === 'personal') {
      const fcmClient = this.nameMap.get(message.target)
      if (fcmClient) {
        fcmClient.sendMessage(message)
        // this.context.ebus.emit('message-client-status', {
        //   mid: message.mid,
        //   name: fcmClient.name,
        //   status: 'fcm-wait'
        // })
        // fcmClient.sendPacket(new MessageServerSocketPacket(message)).then(() => {
        //   this.context.ebus.emit('message-client-status', {
        //     mid: message.mid,
        //     name: fcmClient.name,
        //     status: 'fcm'
        //   })
        // }).catch((e) => {
        //   console.log(`[FCM Error]: ${e.message}`)
        // })
      }
    } else if (message.sendType === 'group') {
      this.nameMap.forEach((fcmClient) => {
        if (fcmClient.group && fcmClient.group === message.target) {
          fcmClient.sendMessage(message)
          // this.context.ebus.emit('message-client-status', {
          //   mid: message.mid,
          //   name: fcmClient.name,
          //   status: 'fcm-wait'
          // })
          // fcmClient.sendPacket(new MessageServerSocketPacket(message)).then(() => {
          //   this.context.ebus.emit('message-client-status', {
          //     mid: message.mid,
          //     name: fcmClient.name,
          //     status: 'fcm'
          //   })
          // }).catch((e) => {
          //   console.log(`[FCM Error]: ${e.message}`)
          // })
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
        console.log(`[FCM client comfirm:Status change]: ${name}`)
        fcmClient.comfirm({ mid })
      }
    }
  }
  /**
   * FCM送达回调指令事件
   * @param mid 
   * @param name 
   */
  onMessageFcmCallback(mid: string, name: string) {
    let fcmClient = this.nameMap.get(name)
    if (fcmClient) {
      console.log(`[FCM client comfirm:message-fcm-callback]: ${name}`)
      this.context.ebus.emit('message-client-status', {
        mid,
        name,
        status: 'fcm-ok-comfirm'
      })
    }
  }
}

class FcmClient extends Client {
  private sendPacketLock: boolean = false
  constructor(
    private pushSubscription: WebPush.PushSubscription,
    retryTimeout: number,
    name: string,
    group: string,
    private ebus: Ebus,
    private options?: WebPush.RequestOptions,
  ) {
    super(retryTimeout, name, group)
  }
  protected send(message: Message) {
    if (!this.sendPacketLock) {
      this.sendPacketLock = true
      console.log(`[FCM loop send]: ${message.message.text}`)
      this.ebus.emit('message-client-status', {
        mid: message.mid,
        name: this.name,
        status: 'fcm-wait'
      })

      let packet = new MessageServerSocketPacket(message)
      this.sendPacket(packet).then(() => {
        this.ebus.emit('message-client-status', {
          mid: packet.data.mid,
          name: this.name,
          status: 'fcm-ok'
        })
        this.comfirm({ mid: packet.data.mid })
      }).catch((e) => {
        console.log(`[FCM send error]: ${e.message}`)
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
  unregister() { }
}