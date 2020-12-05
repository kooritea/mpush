import { Client } from "./model/Client";
import { AuthServerSocketPacket } from "./model/ServerSocketPacket";
import { Context } from "./Context";
import { Message } from "./model/Message.model";
import { Logger } from "./Logger";
import { Throttle } from "./decorator/Throttle";
import { CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE } from "./Define";

/**
 * 负责Client的注册注销、持久化、监听新消息并分发
 */
export class ClientManager {

  private clientScopeMap: Map<string, Map<string, Client>> = new Map()
  private logger: Logger = new Logger('ClientManager')
  public static LOCAL_STORAGE_SCOPE = 'ClientManager'

  constructor(
    private readonly context: Context
  ) {

    this.context.ebus.on('message-start', (message) => {
      this.onMessageStart(message)
    })
    this.recoveryLocalClient()
  }

  /**
   * 服务启动时尝试从本地恢复注册过的客户端  
   * 非互斥的非通用客户端的server自行传入调用进行恢复
   */
  public recoveryLocalClient(): void
  public recoveryLocalClient(scopeName: string, deserializationHandle: (data: TypeObject<any>) => Client): void
  public recoveryLocalClient(scopeName: string = CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE, deserializationHandle: (data: TypeObject<any>) => Client = (data) => {
    return new Client(data.name, data.group)
  }): void {
    try {
      let data = this.context.localStorageManager.get<{
        [clientScopeName: string]: Array<TypeObject<any>>
      }>(ClientManager.LOCAL_STORAGE_SCOPE, 'clients', {}, true)[scopeName] || []
      for (let item of data) {
        const client = deserializationHandle(item)
        this._registerClient(client, scopeName)
        this.logger.info(`name: ${item.name}${item.group ? ',group: ' + item.group : ''}`, scopeName, 'user-recovery')
      }
    } catch (e) {
      this.logger.error(e)
      throw new Error("recovery local Client error")
    }
  }

  /**
   * 注册客户端，注册后可以收到消息事件自动加入消息队列，并进行持久化
   * @param name 
   * @param group 
   * @param client 
   * @param clientScope 可以传入自己的作用域，也可以使用ClientManager.UNCERTAIN_CLIENT_SCOPE这个互斥作用域
   */
  public registerClient<T extends Client>(client: T, clientScopeName: string): T {
    if (client.name) {
      const isLogin = this.clientScopeMap.get(clientScopeName ?? CLIENTMANAGER_UNCERTAIN_CLIENT_SCOPE)?.has(client.name)
      this.logger.info(`name: ${client.name}${client.group ? ',group: ' + client.group : ''}`, clientScopeName ?? "", client.constructor.name, `user-${isLogin ? 'login' : 'register'}`)
      client = this._registerClient(client, clientScopeName)
      this.onClientChange()
      return client
    } else {
      throw new AuthServerSocketPacket({
        code: 403,
        msg: `The name is required`
      })
    }
  }
  private _registerClient<T extends Client>(client: T, clientScopeName: string): T {

    if (!this.clientScopeMap.has(clientScopeName)) {
      this.clientScopeMap.set(clientScopeName, new Map())
    }
    if (this.hasClient(client.name, clientScopeName)) {
      const oldClient = this.getClient(client.name, clientScopeName)
      if (oldClient) {
        client.inherit(oldClient)
      }
    }
    this.clientScopeMap.get(clientScopeName)?.set(client.name, client)
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
  }, clientScopeName?: string): void {
    let clients: Array<Client> = []
    if (target.group) {
      clients = this.getClientByGroup(target.group, clientScopeName)
    } else if (target.name) {
      if (clientScopeName) {
        const client = this.getClient(target.name, clientScopeName)
        if (client) {
          clients.push(client)
        }
      } else {
        clients = this.getClient(target.name)
      }
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
      for (const [_clientScopeName, client] of (this.clientScopeMap.get(clientScopeName) || new Map())) {
        if (client.name === name) {
          return true
        }
      }
    } else {
      for (let clientScpoe of this.clientScopeMap.values()) {
        for (const [_clientScopeName, client] of clientScpoe) {
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
      for (const [_clientScopeName, client] of (this.clientScopeMap.get(clientScopeName) || new Map())) {
        if (client.name === name) {
          return client
        }
      }
    } else {
      const result: Array<Client> = []
      for (let clientScpoe of this.clientScopeMap.values()) {
        for (const [_clientScopeName, client] of clientScpoe) {
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
      for (const [_clientScopeName, client] of (this.clientScopeMap.get(clientScopeName) || new Map())) {
        if (client.group === group) {
          result.push(client)
        }
      }
    } else {
      for (let clientScpoe of this.clientScopeMap.values()) {
        for (const [_clientScopeName, client] of clientScpoe) {
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
    let data: {
      [clientScopeName: string]: Array<TypeObject<any>>
    } = {}
    for (let [clientScopeName, clientScpoe] of this.clientScopeMap) {
      data[clientScopeName] = []
      for (const [name, client] of clientScpoe) {
        data[clientScopeName].push(client.serialization())
      }
    }
    this.context.localStorageManager.set(ClientManager.LOCAL_STORAGE_SCOPE, 'clients', data, sync)
  }
}
