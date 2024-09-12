/**
 * 非可靠客户端，不与其他客户端互斥
 */
import { Context } from "../Context"
import { ServerSocketPacket, MessageServerSocketPacket } from "../model/ServerSocketPacket"
import { QueueClient } from "../model/Client"
import { Message } from "../model/Message.model"
import { Ebus } from "../Ebus"
import { HttpsProxyAgent } from 'https-proxy-agent'
import Axios, { AxiosInstance } from 'axios'
import { Logger } from "../Logger"
import { UncertainServer } from "./Base.server"
import { TelegramGetUpdateResponse, TelegramMessage, TelegramSendMessageResponse } from "src/typings/telegram"
const axios = Axios.create()


export class TelegramServer extends UncertainServer<TelegramClient> {

  public static CLIENT_SCOPE = "WebPushClient"

  protected logger: Logger = new Logger('TelegramServer')
  private bot: TelegramBot

  /**
   * 提供过凭证的对话才能使用其他指令
   */
  private authChatMap: TypeObject<boolean> = {}

  constructor(context: Context) {
    super(context)
    if (this.context.config.telegram.botToken) {
      this.logger.info(`Init`)
      this.bot = new TelegramBot(this.context.config.telegram.botToken, (message) => { this.onNewMessage(message) }, this.context.config.telegram.proxy)
      this.context.clientManager.recoveryLocalClient(TelegramServer.CLIENT_SCOPE, (data) => {
        this.authChatMap[data.chatId] = true
        return new TelegramClient(
          this.bot,
          data.chatId,
          data.name,
          data.group,
          this.context.config.telegram.retryTimeout,
          this.context.ebus,
          this.logger
        )
      })
    }
  }

  private onNewMessage(message: TelegramMessage): void {
    const chatId = String(message.chat.id)
    if (message.text.startsWith('/')) {
      try {
        const [command, ...args] = message.text.slice(1).split(' ')
        if (command === 'help') {
          this.bot.sendMessage(chatId, new TelegramPacket(`Help`, this.getHelp()))
        } else if (command === 'auth') {
          if (args[0] === this.context.config.token) {
            this.authChatMap[chatId] = true
            this.bot.sendMessage(chatId, new TelegramPacket(`Auth success`, '/register {name} {group}'))
          } else {
            this.bot.sendMessage(chatId, new TelegramPacket(`Auth faild`))
          }
        } else if (this.checkChatAuthOrReply(chatId)) {
          switch (command) {
            case 'register': {
              const [name, group] = args
              this.context.clientManager.registerClient(
                new TelegramClient(
                  this.bot,
                  chatId,
                  name,
                  group,
                  this.context.config.telegram.retryTimeout,
                  this.context.ebus,
                  this.logger
                ),
                TelegramServer.CLIENT_SCOPE
              )
              this.bot.sendMessage(chatId, new TelegramPacket(`Register success`, `name: ${name}${group ? `\ngroup: ${group}` : ''}`))
              break
            }
            default: {
              this.bot.sendMessage(chatId, new TelegramPacket(`Unknow command: /${command}`, this.getHelp()))
            }
          }
        }
      } catch (e) {
        this.logger.error(e)
        if (e instanceof ServerSocketPacket) {
          this.bot.sendMessage(chatId, new TelegramPacket(e.cmd, e.data))
        } else {
          this.bot.sendMessage(chatId, new TelegramPacket('Error', e.message))
        }
      }
    }
  }

  private checkChatAuthOrReply(chatId: string): boolean {
    if (this.authChatMap[chatId]) {
      return true
    } else {
      this.bot.sendMessage(chatId, new TelegramPacket('Unauthenticated', '/auth {token}'))
      return false
    }
  }

  private getHelp(cmd?: string) {
    return [
      {
        cmd: 'auth',
        args: [
          '{token}'
        ]
      },
      {
        cmd: 'register',
        args: [
          '{name}',
          '{group}'
        ]
      }
    ].filter((item) => {
      return !cmd || item.cmd === cmd
    }).map((item) => {
      return `/${item.cmd} ${item.args.join(' ')}`
    }).join('\n')
  }
}

class TelegramClient extends QueueClient {

  constructor(
    private bot: TelegramBot,
    private chatId: string,
    name: string,
    group: string,
    retryTimeout: number,
    private ebus: Ebus,
    private logger: Logger
  ) {
    super(Math.max(retryTimeout, 10000), name, group)
  }

  protected async send(message: Message) {
    this.logger.info(`${message.message.text}`, 'loop-send')
    this.ebus.emit('message-client-status', {
      mid: message.mid,
      name: this.name,
      status: 'wait'
    })
    let packet = new MessageServerSocketPacket(message)
    await this.sendPacket(packet).then((res) => {
      this.ebus.emit('message-client-status', {
        mid: packet.data.mid,
        name: this.name,
        status: 'ok'
      })
      this.comfirm({ mid: packet.data.mid })
    }).catch((e) => {
      this.logger.error(`${e.message}`, 'send-error')
    })

  }
  async sendPacket(packet: MessageServerSocketPacket): Promise<void> {
    await this.bot.sendMessage(
      this.chatId,
      new TelegramPacket(packet.data.message.text, packet.data.message.desp, packet.data.message.extra)
    )
  }

  public serialization(): TypeObject<any> {
    return {
      chatId: this.chatId,
      name: this.name,
      group: this.group
    }
  }
}

class TelegramBot {
  private axios: AxiosInstance
  /**
   * tg的update_id，小于或等于这个最后的更新id则将将消息视为已处理
   * 默认忽略启动前的所有消息
   */
  private lastUpdateId: number = 0

  private fastLoopTimer: NodeJS.Timeout | null = null
  constructor(token: string, private onNewMessage: (message: TelegramMessage) => void, proxy?: string) {
    this.axios = Axios.create({
      baseURL: `https://api.telegram.org/bot${token}`,
      httpsAgent: proxy ? new HttpsProxyAgent(proxy) : undefined,
    })
    this.axios.request<TelegramGetUpdateResponse>({
      url: '/getUpdates',
      method: 'get'
    }).then((res) => {
      if (res.data.result.length > 0) {
        this.lastUpdateId = res.data.result[res.data.result.length - 1].update_id
      }
      setTimeout(() => {
        this.loopCheckUpdate()
      }, 5000)
      this.fastLoopTimer = setTimeout(() => {
        this.fastLoopTimer = null
      }, 1000 * 60 * 10)
    })
  }

  private loopCheckUpdate() {
    this.axios.request<TelegramGetUpdateResponse>({
      url: '/getUpdates',
      method: 'get'
    }).then((res) => {
      let hasNewMessage = false
      for (const update of res.data.result) {
        if (update.update_id > this.lastUpdateId && update.message) {
          this.onNewMessage(update.message)
          this.lastUpdateId = update.update_id
          hasNewMessage = true
        }
      }
      if (hasNewMessage) {
        if (this.fastLoopTimer) {
          clearTimeout(this.fastLoopTimer)
        }
        this.fastLoopTimer = setTimeout(() => {
          this.fastLoopTimer = null
        }, 1000 * 60 * 10)
      }
      setTimeout(() => {
        this.loopCheckUpdate()
      }, this.fastLoopTimer ? 5000 : 30000)
    })
  }

  public async sendMessage(chatId: string, telegramPacket: TelegramPacket): Promise<void> {
    try {
      await this.axios.request<TelegramSendMessageResponse>({
        url: '/sendMessage',
        method: 'post',
        data: {
          chat_id: chatId,
          ...telegramPacket.toArgs()
        },
      })
    } catch (e) {
      if (e.isAxiosError && e.response?.data?.error_code === 400) {
        await this.axios.request<TelegramSendMessageResponse>({
          url: '/sendMessage',
          method: 'post',
          data: {
            chat_id: chatId,
            text: e.response?.data?.description
          },
        })
      } else {
        throw e
      }
    }
  }
}

class TelegramPacket {
  constructor(
    private text: string,
    private desp?: string,
    public extra: TypeObject<any> = {},
  ) { }

  public toArgs(): { text: string, parse_mode: string } {
    let result = {
      ...(this.extra.telegram || {}),
      text: '',
      parse_mode: Object.hasOwn(this.extra || {}, 'parse_mode') ? this.extra.parse_mode : 'MarkdownV2'
    }
    if (result.parse_mode === 'HTML') {
      result.text = `<b>${this.text}</b>`
      if (this.desp) {
        result.text += this.desp
      }
    } else {
      result.text = `*${this.replaceMdChar(this.text)}*`
      if (this.desp) {
        result.text += '\n'
        if (typeof this.desp === 'object' && this.desp !== null) {
          result.text += `\`${this.replaceMdChar(JSON.stringify(this.desp, null, 2))}\``
        } else {
          if (this.extra.parse_mode === 'MarkdownV2' || this.extra.parse_mode === 'Markdown') {
            result.text += `${this.desp}`
          } else {
            result.text += `\`${this.replaceMdChar(this.desp)}\``
          }
        }
      }
      if (this.extra.scheme) {
        if (!result.reply_markup) {
          result.reply_markup = {}
        }
        if (!result.reply_markup.inline_keyboard) {
          result.reply_markup.inline_keyboard = []
        }
        result.reply_markup.inline_keyboard.unshift([{
          text: 'Open Scheme',
          url: this.extra.scheme
        }])
      }
    }
    return result
  }

  private replaceMdChar(text: string): string {
    return text.replace(/\_/g, '\\_')
      .replace(/\*/g, '\\*')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\~/g, '\\~')
      .replace(/\`/g, '\\`')
      .replace(/\>/g, '\\>')
      .replace(/\#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/\-/g, '\\-')
      .replace(/\=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/\!/g, '\\!')
  }
}