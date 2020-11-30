import { Context } from "../Context";
import { Message } from "../model/Message.model";
import { QueueClient } from "../model/Client";
import Axios, { AxiosInstance, AxiosPromise, AxiosProxyConfig } from 'axios'
import * as HttpsProxyAgent from 'https-proxy-agent'
import { MessageServerSocketPacket, ServerSocketPacket } from "../model/ServerSocketPacket";
import { Ebus } from "../Ebus";
import { Logger } from "../Logger";

export class WebhookServer {

  private logger: Logger = new Logger('WebhookServer')

  constructor(
    private readonly context: Context
  ) {
    this.logger.info(`Init`)
    this.context.config.webhook.clients.forEach((item) => {
      this.registerClient(
        item.url,
        <'GET' | 'POST'>item.method,
        item.name,
        item.group,
        new HttpsProxyAgent(item.proxy || this.context.config.webhook.proxy)
      )
      this.logger.info(`${item.name}`, 'register-client')
    })
  }

  private registerClient(url: string, method: 'GET' | 'POST', name: string, group: string, proxy: HttpsProxyAgent | undefined) {
    const client = new WebhookClient(
      url,
      method,
      name,
      group,
      proxy,
      this.context.config.token,
      this.context.config.webhook.retryTimeout,
      this.context.ebus
    )
    this.context.clientManager.registerClient(
      name,
      group,
      client
    )
  }
}

class WebhookClient extends QueueClient {
  private axios: AxiosInstance
  constructor(
    private url: string,
    private method: 'GET' | 'POST',
    name: string,
    group: string,
    proxy: HttpsProxyAgent | undefined,
    private token: string,
    retryTimeout: number,
    private ebus: Ebus
  ) {
    super(retryTimeout, name, group)
    this.axios = Axios.create({ httpsAgent: proxy })
  }
  protected send(message: Message) {
    this.sendPacket(new MessageServerSocketPacket(message)).then((response) => {
      this.ebus.emit('message-client-status', {
        mid: message.mid,
        name: this.name,
        status: 'ok'
      })
      this.comfirm({ mid: message.mid })
    }).catch((e) => {
      this.ebus.emit('message-client-status', {
        mid: message.mid,
        name: this.name,
        status: 'wait'
      })
    })
  }
  sendPacket(packet: ServerSocketPacket): AxiosPromise {
    if (this.method === 'GET') {
      return this.axios({
        url: this.url,
        method: 'GET',
        headers: {
          authorization: this.token
        },
        params: {
          text: packet.data?.message?.text,
          desp: packet.data?.message?.desp,
          ...packet.data?.message?.extra
        }
      })
    } else {
      return this.axios({
        url: this.url,
        method: 'POST',
        headers: {
          authorization: this.token
        },
        data: packet
      })
    }
  }
}