import { Ebus } from "./Ebus";
import { Config } from "./Config";
import { MessageManager } from "./MessageManager";
import { ClientManager } from "./ClientManager";
import { LocalStorageManager } from "./LocalStorageManager";

export class Context {
  public readonly ebus: Ebus = new Ebus()
  public readonly messageManager: MessageManager
  public readonly clientManager: ClientManager
  public readonly localStorageManager: LocalStorageManager
  public readonly config = Config
  constructor() {
    this.localStorageManager = new LocalStorageManager()
    this.clientManager = new ClientManager(this)
    this.messageManager = new MessageManager(this)
  }
}