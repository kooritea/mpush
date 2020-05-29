import { Context } from "../Context";
import { Message } from "../model/Message.model";
import { Client } from "../model/Client";
import Axios, { AxiosInstance, AxiosPromise, AxiosProxyConfig } from 'axios'
import { MessageServerSocketPacket, ServerSocketPacket } from "../model/ServerSocketPacket";
import { Ebus } from "../Ebus";

export class WebhookServer {

  constructor(
    private readonly context: Context
  ) {
    console.log(`[WebHook-Server] Init`)
    this.context.config.webhook.clients.forEach((item) => {
      this.registerClient(
        item.url,
        <'GET' | 'POST'>item.method,
        item.name,
        item.group,
        item.proxy || this.context.config.webhook.proxy
      )
      console.log(`[WebHook-Server] register client ${item.name}`)
    })
  }

  private registerClient(url: string, method: 'GET' | 'POST', name: string, group: string, proxy: AxiosProxyConfig) {
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

class WebhookClient extends Client {
  private axios: AxiosInstance
  constructor(
    private url: string,
    private method: 'GET' | 'POST',
    name: string,
    group: string,
    proxy: AxiosProxyConfig,
    private token: string,
    retryTimeout: number,
    private ebus: Ebus
  ) {
    super(retryTimeout, name, group)
    this.axios = proxy.host && proxy.port ? Axios.create({ proxy }) : Axios.create()
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
  unregister() { }
}