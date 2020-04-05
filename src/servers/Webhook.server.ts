import { Context } from "../Context";
import { Message } from "../model/Message.model";
import { Client } from "../model/Client";
import Axios, { AxiosInstance, AxiosPromise, AxiosProxyConfig } from 'axios'
import { MessageServerSocketPacket, ServerSocketPacket } from "../model/ServerSocketPacket";
import { Ebus } from "../Ebus";

export class WebhookServer {
  private nameMap: Map<string, WebhookClient> = new Map()
  constructor(
    private readonly context: Context
  ) {
    this.context.ebus.on('message-start', (message) => {
      this.onMessageStart(message)
    })
    this.context.config.webhook.clients.forEach((item) => {
      this.registerClient(
        item.url,
        <'GET' | 'POST'>item.method,
        item.name,
        item.group,
        item.proxy || this.context.config.webhook.proxy
      )
    })
  }

  private onMessageStart(message: Message) {
    if (message.sendType === 'personal') {
      const client = this.nameMap.get(message.target)
      if (client) {
        client.sendMessage(message)
      }
    } else if (message.sendType === 'group') {
      this.nameMap.forEach((item) => {
        if (item.group && item.group === message.target) {
          item.sendMessage(message)
        }
      })
    }
  }

  private registerClient(url: string, method: 'GET' | 'POST', name: string, group: string, proxy: AxiosProxyConfig) {
    this.context.messageManager.registerUser(
      name,
      group
    )
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
    this.nameMap.set(name, client)
  }
}

class WebhookClient extends Client<Message>{
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
      this.comfirm()
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
        params: {
          token: this.token,
          text: packet.data?.message?.text,
          desp: packet.data?.message?.desp,
          ...packet.data?.message?.extra
        }
      })
    } else {
      return this.axios({
        url: this.url,
        method: 'POST',
        data: {
          token: this.token,
          ...packet
        }
      })
    }
  }
}