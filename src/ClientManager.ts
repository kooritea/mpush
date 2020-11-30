import { Ebus } from "./Ebus";
import { Client } from "./model/Client";
import { AuthServerSocketPacket } from "./model/ServerSocketPacket";
import { Context } from "./Context";
import { Message } from "./model/Message.model";
import { Logger } from "./Logger";
import { Throttle } from "./decorator/Throttle";
import { group } from "console";

export class ClientManager {

  private clientMap: Map<string, Client> = new Map()
  private logger: Logger = new Logger('ClientManager')
  public static LOCAL_STORAGE_SCOPE = 'ClientManager'


  constructor(
    private readonly context: Context,
    private readonly ebus: Ebus
  ) {

    this.context.ebus.on('message-start', (message) => {
      this.onMessageStart(message)
    })
    this.recoveryLocalClient()
  }

  /**
   * 服务启动时尝试从本地恢复注册过的客户端
   */
  private recoveryLocalClient(): void {
    for (let { name, group } of this.context.localStorageManager.get<Array<{ name: string, group: string }>>(ClientManager.LOCAL_STORAGE_SCOPE, 'clients', [], true)) {
      const client = new Client(name, group)
      this._registerClient(name, group, client)
      this.logger.info(`name: ${name}${group ? ',group: ' + group : ''}`, 'user-recovery')
    }
  }

  /**
   * name为空会抛出AuthServerSocketPacket
   * 只有websocket这些与其他客户端互斥的才会使用这个管理器
   * FCM、WebPush这些不可靠推送由server里自己管理客户端  
   * @param name 
   * @param group 
   */

  public registerClient<T extends Client>(name: string, group: string, client: T): T {
    if (name) {
      this.logger.info(`name: ${name}${group ? ',group: ' + group : ''}`, `user-${this.clientMap.has(name) ? 'login' : 'register'}`)
      client = this._registerClient(name, group, client)
      this.onClientChange()
      return client
    } else {
      throw new AuthServerSocketPacket({
        code: 403,
        msg: `The name is required`
      })
    }
  }
  private _registerClient<T extends Client>(name: string, group: string, client: T): T {
    if (this.clientMap.has(name)) {
      const oldClient = <Client>this.clientMap.get(name)
      client.inherit(oldClient)
    }
    this.clientMap.set(name, client)
    return client
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
    this.onClientChange()
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

  @Throttle(5000)
  private onClientChange(): void {
    this.clientLocalSave()
  }

  public clientLocalSave(sync = false): void {
    let data: Array<{
      name: string | undefined,
      group: string | undefined
    }> = []
    for (let name of this.clientMap.keys()) {
      const client = this.clientMap.get(name)
      data.push({
        name: client?.name,
        group: client?.group
      })
    }
    this.context.localStorageManager.set(ClientManager.LOCAL_STORAGE_SCOPE, 'clients', data, sync)
  }
}
