/**
 * WebSocketClient
 * create 2019/8/1
 */

import Client from "./Client";
import { Connection } from "ws";
import { WebSocketMessage, ClientPostMessageCallback, ClientPostMessage } from "../../typings";
import Message from "./Message";

export default class WebSocketClient extends Client {

    private connection: Connection
    private postMessage: ClientPostMessage
    private postMessageCallback: ClientPostMessageCallback
    private readonly messages: Message[]
    private SendTimer: {
        mid: number,
        timer: NodeJS.Timer
    } | null

    constructor(name: string, connection: Connection, postMessage: ClientPostMessage, postMessageCallback: ClientPostMessageCallback, group?: string) {
        super(name, group)
        this.connection = connection
        this.postMessage = postMessage
        this.postMessageCallback = postMessageCallback
        this.messages = []
        this.SendTimer = null

        this.setConnection(connection)
    }
    public setConnection(connection: Connection): void {
        if (this.connection !== connection) {
            this.connection.close()
            this.connection.removeAllListeners('decodeMessage')
            this.connection.removeAllListeners('encodeMessage')
        }
        this.connection = connection
        this.connection.on('decodeMessage', this.WebSocketClientMessage.bind(this))
    }

    /**
     * 添加一条消息到等待推送队列
     * @param message 
     */
    public send(message: Message): void {
        this.messages.push(message)
        this.autoSend()
    }

    /**
     * 自动从推送队列获取条消息推送
     * 超时情况下将会由定时器再次调用自身
     * 确认回复的情况下将由ws抛出的回复事件调用该方法并清除定时器和将该消息从消息队列除去
     */
    private autoSend(): void {
        if (!this.SendTimer && this.messages.length > 0) {
            const message = this.messages[0]
            this.connection.emit('encodeMessage', {
                cmd: 'MESSAGE',
                data: {
                    sendType: message.sendType,
                    target: message.target,
                    mid: message.mid,
                    message: {
                        text: message.text,
                        desp: message.desp
                    }
                }
            })
            this.SendTimer = {
                mid: message.mid,
                timer: setTimeout(() => {
                    // 响应超时
                    this.SendTimer = null
                    this.autoSend()
                }, 10000)
            }
        }
    }

    /**
    * websocket接收到消息会调用该方法
    * @param packet 
    */
    private WebSocketClientMessage(packet: WebSocketMessage.Packet): void {
        if (packet.cmd === 'MESSAGE') {
            const data: WebSocketMessage.MessageData = <WebSocketMessage.MessageData>packet.data
            const message = new Message(data.sendType, data.target, data.message.text, data.message.desp)
            // 交给总线选择推送目标
            this.postMessage(message)
        } else if (packet.cmd === 'MESSAGE_CALLBACK') {
            const data: WebSocketMessage.MessageCallbackData = <WebSocketMessage.MessageCallbackData>packet.data
            if (this.SendTimer && this.SendTimer.mid === data.mid) {
                // 如果SendTimer不存在,或与等待中的mid不相同,则表示已超时,不进入if忽略该回复
                this.clearMessage(data.mid)
                clearTimeout(this.SendTimer.timer)
                this.SendTimer = null
                this.autoSend()

                this.postMessageCallback(data.mid)
            }
        }
    }
    /**
     * 删除等待队列中已确认送达的消息
     * @param mid
     */
    private clearMessage(mid: number): void {
        for (let index = 0; index < this.messages.length; index++) {
            if (this.messages[index].mid === mid) {
                this.messages.splice(index, 1)
                break
            }
        }
    }
}