import { Context } from "../Context";
import { Message } from "../model/Message.model";
import { Client } from "../model/Client";
import Axios, { AxiosInstance, AxiosPromise } from 'axios'
import { MessageServerSocketPacket } from "../model/ServerSocketPacket";
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
        item.URL,
        <'GET' | 'POST'>item.METHOD,
        item.NAME,
        item.GROUP
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
        if (item.group === message.target) {
          item.sendMessage(message)
        }
      })
    }
  }

  private registerClient(url: string, method: 'GET' | 'POST', name: string, group: string) {
    this.context.messageManager.registerUser(
      name,
      group
    )
    const client = new WebhookClient(
      url,
      method,
      name,
      group,
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
    public name: string,
    public group: string,
    private token: string,
    retryTimeout: number,
    private ebus: Ebus
  ) {
    super(retryTimeout)
    this.axios = Axios.create({

    })
  }
  protected send(message: Message) {
    this.sendRequest(message).then((response) => {
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
  private sendRequest(message: Message): AxiosPromise {
    if (this.method === 'GET') {
      return this.axios({
        url: this.url,
        method: 'GET',
        params: {
          token: this.token,
          text: message.message.text,
          desp: message.message.desp,
          ...message.message.extra
        }
      })
    } else {
      return this.axios({
        url: this.url,
        method: 'POST',
        data: {
          token: this.token,
          ...new MessageServerSocketPacket(message)
        }
      })
    }
  }
}