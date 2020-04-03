import { Ebus } from "./Ebus";
import { Config } from "./Config";
import { MessageManager } from "./MessageManager";

export class Context {
  public readonly ebus: Ebus = new Ebus()
  public readonly messageManager: MessageManager
  public readonly config = Config
  constructor() {
    this.messageManager = new MessageManager(this.ebus)
  }
}