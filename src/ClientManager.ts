import { Ebus } from "./Ebus";
import { Client } from "./model/Client";
import { AuthServerSocketPacket } from "./model/ServerSocketPacket";
import { Context } from "./Context";
import { Message } from "./model/Message.model";
import { Logger } from "./Logger";
import { Throttle } from "./decorator/Throttle";
import { CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE } from "./Define";


/**
 * 负责Client的注册注销、持久化、监听新消息并分配
 */
export class ClientManager {

  private clientScopeMap: Map<string, Map<string, Client>> = new Map()
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
   * 仅恢复互斥作用域中的客户端，其他作用域由server主动恢复
   */
  private recoveryLocalClient(): void {
    for (let { name, group } of this.context.localStorageManager.get<Array<{ name: string, group: string }>>(ClientManager.LOCAL_STORAGE_SCOPE, 'clients', [], true)) {
      const client = new Client(name, group)
      this._registerClient(name, group, client, CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE)
      this.logger.info(`name: ${name}${group ? ',group: ' + group : ''}`, 'user-recovery')
    }
  }

  /**
   * 注册客户端，注册后可以收到消息事件自动加入消息队列，并进行持久化
   * @param name 
   * @param group 
   * @param client 
   * @param clientScope 可以传入自己的作用域，也可以使用ClientManager.UNCERTAIN_CLIENT_SCOPE这个互斥作用域
   */
  public registerClient<T extends Client>(name: string, group: string, client: T, clientScopeName: string): T {
    if (name) {
      const isLogin = this.clientScopeMap.get(clientScopeName ?? CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE)?.has(name)
      this.logger.info(`name: ${name}${group ? ',group: ' + group : ''}`, clientScopeName ?? "", `user-${isLogin ? 'login' : 'register'}`)
      client = this._registerClient(name, group, client, clientScopeName)
      this.onClientChange()
      return client
    } else {
      throw new AuthServerSocketPacket({
        code: 403,
        msg: `The name is required`
      })
    }
  }
  private _registerClient<T extends Client>(name: string, group: string, client: T, clientScopeName: string): T {

    if (!this.clientScopeMap.has(clientScopeName)) {
      this.clientScopeMap.set(clientScopeName, new Map())
    }
    if (this.clientScopeMap.get(clientScopeName)?.has(name)) {
      const oldClient = <Client>this.clientScopeMap.get(clientScopeName)?.get(name)
      client.inherit(oldClient)
    }
    this.clientScopeMap.get(clientScopeName)?.set(clientScopeName, client)
    client.setClientScope(clientScopeName)
    return client
  }

  /**
   * 和注册不一样，注销将会注销所有域的客户端
   * @param target 
   */
  public unRegisterClient(target: {
    name?: string,
    group?: string
  }): void {
    let clients: Array<Client>
    if (target.group) {
      clients = this.getClientByGroup(target.group)
    } else {
      clients = this.getClient(name)
    }
    clients.forEach((client) => {
      client.unRegister()
      this.context.ebus.emit('unregister-client', { client })
      this.clientScopeMap.get(client.getClientScope())?.delete(client.name)
    })
    this.onClientChange()
  }

  /**
   * 
   * @param name 
   * @param clientScopeName 不传该参数则搜索全作用域
   */
  public hasClient(name: string, clientScopeName?: string): boolean {
    if (clientScopeName) {
      for (const [name, client] of this.clientScopeMap.get(CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE) || []) {
        if (client.name === name) {
          return true
        }
      }
    } else {
      for (let clientScpoe of this.clientScopeMap.values()) {
        for (const [name, client] of clientScpoe) {
          if (client.name === name) {
            return true
          }
        }
      }
    }
    return false
  }

  public getClient(name: string): Array<Client>
  public getClient(name: string, clientScopeName: string): Client | null
  public getClient(name: string, clientScopeName?: string): Client | Array<Client> | null {
    if (clientScopeName) {
      for (let clientScpoe of this.clientScopeMap.values()) {
        for (const [name, client] of clientScpoe) {
          if (client.name === name) {
            return client
          }
        }
      }
    } else {
      const result: Array<Client> = []
      for (let clientScpoe of this.clientScopeMap.values()) {
        for (const [name, client] of clientScpoe) {
          if (client.name === name) {
            result.push(client)
          }
        }
      }
      return result
    }
    return null
  }

  /**
   * 不指定域则搜索全部
   * @param group 
   * @param clientScopeName 
   */
  public getClientByGroup(group: string, clientScopeName?: string): Array<Client> {
    const result: Array<Client> = []
    if (clientScopeName) {
      for (const [name, client] of (this.clientScopeMap.get(clientScopeName) || [])) {
        if (client.group === group) {
          result.push(client)
        }
      }
    } else {
      for (let clientScpoe of this.clientScopeMap.values()) {
        for (const [name, client] of clientScpoe) {
          if (client.group === group) {
            result.push(client)
          }
        }
      }
    }
    return result
  }

  private onMessageStart(message: Message): void {
    if (message.sendType === 'personal') {
      const clients = this.getClient(message.target)
      clients.forEach((client) => {
        client.sendMessage(message)
      })
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
    for (let name of this.clientScopeMap.get(CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE)?.keys() || []) {
      const client = this.clientScopeMap.get(CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE)?.get(name)
      data.push({
        name: client?.name,
        group: client?.group
      })
    }
    this.context.localStorageManager.set(ClientManager.LOCAL_STORAGE_SCOPE, 'clients', data, sync)
  }
}
