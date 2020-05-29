import { Ebus } from "./Ebus";
import { Config } from "./Config";
import { MessageManager } from "./MessageManager";
import { ClientManager } from "./ClientManager";

export class Context {
  public readonly ebus: Ebus = new Ebus()
  public readonly messageManager: MessageManager
  public readonly clientManager: ClientManager
  public readonly config = Config
  constructor() {
    this.messageManager = new MessageManager(this, this.ebus)
    this.clientManager = new ClientManager(this, this.ebus)
  }
}