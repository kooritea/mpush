/**
 * 非可靠客户端，不与其他客户端互斥
 */
import { Context } from "../Context";
import { ServerSocketPacket, MessageServerSocketPacket, InfoServerSocketPacket } from "../model/ServerSocketPacket";
import { Client, QueueClient } from "../model/Client";
import { Message } from "../model/Message.model";
import { Ebus } from "../Ebus";
import { HttpsProxyAgent } from 'https-proxy-agent'
import Axios from 'axios'
import { Logger } from "../Logger";
import { UncertainServer } from "./Base.server";
import { MessageStatus, TypeObject } from "src/typings";
import { JWT } from "google-auth-library";
const axios = Axios.create()

interface AccountInfo {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

export class FCMServer extends UncertainServer<FCMClient> {

  public static CLIENT_SCOPE = "FCMClient"

  private readonly options: {
    account: AccountInfo,
    proxy: HttpsProxyAgent<string> | undefined
  }
  protected logger: Logger = new Logger('FCMServer')

  constructor(context: Context) {
    super(context)
    if (this.context.config.fcm.account) {
      this.logger.info(`Init`)
      this.options = {
        account: this.context.config.fcm.account,
        proxy: undefined
      }
      if (this.context.config.fcm.proxy) {
        this.options.proxy = new HttpsProxyAgent(this.context.config.fcm.proxy);
      }
      this.context.clientManager.recoveryLocalClient(FCMServer.CLIENT_SCOPE, (data) => {
        return new FCMClient(
          data.token,
          this.context.config.fcm.retryTimeout,
          data.name,
          data.group,
          this.context.ebus,
          this.options,
          this.logger
        )
      })
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
        client.sendPacket(new InfoServerSocketPacket("缺少fcm.account信息"))
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
      account: AccountInfo,
      proxy: HttpsProxyAgent<string> | undefined
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
  async sendPacket(packet: ServerSocketPacket): Promise<void> {
    const jwtClient =  new JWT(
      this.options.account.client_email,
      '',
      this.options.account.private_key,
      ['https://www.googleapis.com/auth/firebase.messaging'],
    );
    const tokens = await jwtClient.authorize();
    await axios.request({
      method: 'post',
      url: `https://fcm.googleapis.com/v1/projects/${this.options.account.project_id}/messages:send`,
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      },
      httpsAgent: this.options.proxy,
      data: {
        message: {
          token: this.token,
          priority: 'high',
          data: packet
        }
      }
    })
  }

  public serialization(): TypeObject<any> {
    return {
      token: this.token,
      name: this.name,
      group: this.group
    }
  }
}
