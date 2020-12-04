/**
 * 非可靠客户端，不与其他客户端互斥
 */
import { Context } from "../Context";
import { ServerSocketPacket, MessageServerSocketPacket, InfoServerSocketPacket } from "../model/ServerSocketPacket";
import { Client, QueueClient } from "../model/Client";
import { Message } from "../model/Message.model";
import { Ebus } from "../Ebus";
import * as HttpsProxyAgent from 'https-proxy-agent'
import Axios from 'axios'
import { Logger } from "../Logger";
import { UncertainServer } from "./Base.server";
const axios = Axios.create()

export class FCMServer extends UncertainServer<FCMClient> {

  public static CLIENT_SCOPE = "FCMServer"

  private readonly options: {
    serverKey: string,
    proxy: HttpsProxyAgent | undefined
  }
  protected logger: Logger = new Logger('FCMServer')

  constructor(context: Context) {
    super(context)
    if (this.context.config.fcm.projectId && this.context.config.fcm.applicationId && this.context.config.fcm.apiKey && this.context.config.fcm.serverKey) {
      this.logger.info(`Init`)
      this.options = {
        serverKey: this.context.config.fcm.serverKey,
        proxy: undefined
      }
      if (this.context.config.fcm.proxy) {
        this.options.proxy = new HttpsProxyAgent(this.context.config.fcm.proxy);
      }
      this.context.ebus.on('register-fcm', ({ client, token }) => {
        this.registerFCM(client, token)
      })
      this.context.ebus.on('message-client-status', ({ name, mid, status }) => {
        this.onMessageClientStatus(name, mid, status)
      })
      this.context.ebus.on('message-fcm-callback', ({ mid, name }) => {
        this.onMessageFCMCallback(mid, name)
      })
      // this.context.ebus.on('unregister-fcm', ({ client }) => {
      //   this.context.clientManager.unRegisterClient({ name: client.name }, FCMServer.CLIENT_SCOPE)
      // })
    } else {
      this.context.ebus.on('register-fcm', ({ client }) => {
        client.sendPacket(new InfoServerSocketPacket("fcm.projectId或fcm.applicationId或fcm.apiKey或fcm.serverKey"))
      })
    }
  }

  registerFCM(client: Client, token: string) {
    const fcmClient = new FCMClient(
      token,
      this.context.config.fcm.retryTimeout,
      client.name,
      client.group,
      this.context.ebus,
      this.options,
      this.logger
    )
    this.context.clientManager.registerClient(fcmClient, FCMServer.CLIENT_SCOPE)
  }

  /**
   * 判断该message是否有通过FCMClient发送  
   * 如是且状态为ok,则调用fcmClient.comfirm
   * @param message 
   * @param status 
   */
  private onMessageClientStatus(name: string, mid: string, status: MessageStatus): void {
    if (status === 'ok') {
      let fcmClient = this.context.clientManager.getClient(name, FCMServer.CLIENT_SCOPE)
      if (fcmClient) {
        this.logger.info(`${name}`, 'message-status-change')
        fcmClient.comfirm({ mid })
        fcmClient.deleteMessage({ mid })
      }
    }
  }
  /**
   * FCM送达回调指令事件
   * @param mid 
   * @param name 
   */
  onMessageFCMCallback(mid: string, name: string) {
    let fcmClient = this.context.clientManager.getClient(name, FCMServer.CLIENT_SCOPE)
    if (fcmClient) {
      this.logger.info(`${name}`, 'message-fcm-callback')
      this.context.ebus.emit('message-client-status', {
        mid,
        name,
        status: 'fcm-ok'
      })
    }
  }
}

class FCMClient extends QueueClient {

  constructor(
    private token: string,
    retryTimeout: number,
    name: string,
    group: string,
    private ebus: Ebus,
    private options: {
      serverKey: string,
      proxy: HttpsProxyAgent | undefined
    },
    private logger: Logger
  ) {
    super(retryTimeout, name, group)
  }
  protected send(message: Message) {
    this.logger.info(`${message.message.text}`, 'loop-send')
    this.ebus.emit('message-client-status', {
      mid: message.mid,
      name: this.name,
      status: 'fcm-wait'
    })

    let packet = new MessageServerSocketPacket(message)
    this.sendPacket(packet).then((res) => {
      this.ebus.emit('message-client-status', {
        mid: packet.data.mid,
        name: this.name,
        status: 'fcm-send'
      })
      this.comfirm({ mid: packet.data.mid })
    }).catch((e) => {
      this.logger.error(`${e.message}`, 'send-error')
    })

  }
  sendPacket(packet: ServerSocketPacket): Promise<void> {
    return axios.post('https://fcm.googleapis.com/fcm/send', {
      "data": packet,
      to: this.token,
      priority: 'high'
    }, {
      headers: {
        Authorization: `key=${this.options.serverKey}`
      },
      httpsAgent: this.options.proxy
    })
  }
}