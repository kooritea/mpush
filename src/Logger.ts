import * as Utils from "./Utils";

export class Logger {

  private static Colors = {
    info: 32,
    warn: 33,
    error: 31
  }

  private context: string
  constructor(context: string) {
    this.context = context
  }

  public info(message: any, context?: string) {
    const contexts = [this.context]
    if (context) {
      contexts.push(context)
    }
    Logger.print('info', contexts, message)
  }
  public warn(message: any, context?: string) {
    const contexts = [this.context]
    if (context) {
      contexts.push(context)
    }
    Logger.print('warn', contexts, message)
  }
  public error(message: any, context?: string) {
    const contexts = [this.context]
    if (context) {
      contexts.push(context)
    }
    Logger.print('error', contexts, message)
  }

  private static print(level: 'info' | 'warn' | 'error', context: string[], message: any): void {
    switch (typeof message) {
      case 'boolean':
      case 'number':
      case 'undefined':
      case 'bigint':
      case 'string':
        console.log(`\x1B[${Logger.Colors[level]}m${Utils.formatDate()} [${context.join('][')}]\x1B[0m ${message}`)
        break
      default:
        console.log(`\x1B[${Logger.Colors[level]}m${Utils.formatDate()} [${context.join('][')}]\x1B[0m`)
        console.log(message)
    }

  }
}