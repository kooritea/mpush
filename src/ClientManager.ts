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
   * 重复注册或name为空会抛出AuthServerSocketPacket
   * 只有websocket这些与其他客户端互斥的才会使用这个管理器
   * FCM、WebPush这些不可靠推送由server里自己管理客户端
   * @param name 
   * @param group 
   */
  public registerClient(name: string, group: string, client: Client): void {
    if (name && (!this.clientMap.has(name) || this.clientMap.get(name)?.constructor === client.constructor)) {
      this.logger.info(`name: ${name}${group ? ',group: ' + group : ''}`, 'user-register')
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