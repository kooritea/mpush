import { Ebus } from "./Ebus";
import { Client } from "./model/Client";
import { AuthServerSocketPacket } from "./model/ServerSocketPacket";
import { Context } from "./Context";
import { Message } from "./model/Message.model";

export class ClientManager {

  private clientMap: Map<string, Client> = new Map()

  constructor(
    private readonly context: Context,
    private readonly ebus: Ebus
  ) {
    this.context.ebus.on('message-start', (message) => {
      this.onMessageStart(message)
    })
  }

  /**
   * 重复注册或name为空会抛出AuthServerSocketPacket
   * @param name 
   * @param group 
   */
  public registerClient(name: string, group: string, client: Client): void {
    if (name && (!this.clientMap.has(name) || this.clientMap.get(name)?.constructor === client.constructor)) {
      console.log(`[user-register]: name: ${name}${group ? ',group: ' + group : ''}`)
      this.clientMap.get(name)?.unregister()
      this.clientMap.set(name, client)
    } else {
      if (name) {
        throw new AuthServerSocketPacket({
          code: 403,
          msg: `The name [${name}] is already used`
        })
      } else {
        throw new AuthServerSocketPacket({
          code: 403,
          msg: `The name is required`
        })
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