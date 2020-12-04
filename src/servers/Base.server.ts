import { Context } from "src/Context";
import { Logger } from "src/Logger";
import { QueueClient } from "src/model/Client";

export abstract class BaseServer {

  /**
   * 
   */
  public abstract onMessageStart(): void

  public abstract onMessageEnd(): void

}

export abstract class UncertainServer<T extends QueueClient> {

  protected abstract logger: Logger

  constructor(
    protected readonly context: Context
  ) {

  }
}