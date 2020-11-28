import { Ebus } from "./Ebus";
import { Client } from "./model/Client";
import { AuthServerSocketPacket } from "./model/ServerSocketPacket";
import { Context } from "./Context";
import { Message } from "./model/Message.model";
import { Logger } from "./Logger";

export class ClientManager {

  private clientMap: Map<string, Client> = new Map()
  private logger: Logger = new Logger('ClientManager')

  constructor(
    private readonly context: Context,
    private readonly ebus: Ebus
  ) {
    this.context.ebus.on('message-start', (message) => {
      this.onMessageStart(message)
    })
  }

  /**
   * name为空会抛出AuthServerSocketPacket
   * 只有websocket这些与其他客户端互斥的才会使用这个管理器
   * FCM、WebPush这些不可靠推送由server里自己管理客户端  
   * @param name 
   * @param group 
   */
  public registerClient(name: string, group: string, client: Client): Client {
    if (name) {
      this.logger.info(`name: ${name}${group ? ',group: ' + group : ''}`, `user-${this.clientMap.has(name) ? 'login' : 'register'}`)
      if (this.clientMap.has(name)) {
        const oldClient = <Client>this.clientMap.get(name)
        client.inherit(oldClient)
      }
      this.clientMap.set(name, client)
      return client
    } else {
      throw new AuthServerSocketPacket({
        code: 403,
        msg: `The name is required`
      })
    }
  }

  public unRegisterClient(target: {
    name?: string,
    group?: string
  }): void {
    if (target.group) {
      this.getClientByGroup(target.group).forEach((client) => {
        client.unRegister()
        this.context.ebus.emit('unregister-client', { client })
        this.clientMap.delete(client.name)
      })
    }
    if (target.name) {
      const client = this.clientMap.get(name)
      if (client) {
        client.unRegister()
        this.context.ebus.emit('unregister-client', { client })
        this.clientMap.delete(client.name)
      }

    }
  }

  public hasClient(name: string): boolean {
    return this.clientMap.has(name)
  }

  public getClient(name: string) {
    return this.clientMap.get(name)
  }

  public getClientByGroup(group: string): Array<Client> {
    const result: Array<Client> = []
    for (const [name, client] of this.clientMap) {
      if (client.group === group) {
        result.push(client)
      }
    }
    return result
  }

  private onMessageStart(message: Message): void {
    if (message.sendType === 'personal') {
      const client = this.getClient(message.target)
      if (client) {
        client.sendMessage(message)
      }
    } else if (message.sendType === 'group') {
      this.getClientByGroup(message.target).forEach((client) => {
        client.sendMessage(message)
      })
    }
  }

}
