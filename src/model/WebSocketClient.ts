/**
 * WebSocketClient
 * create 2019/8/1
 */

import Client from "./Client";
import config from "../_config";
import { Connection } from "ws";
import { WebSocketMessage, PostMessageCallback, PostMessage } from "../../typings";
import Message from "./Message";

export default class WebSocketClient extends Client {

    private connection: Connection
    private postMessage: PostMessage
    private postMessageCallback: PostMessageCallback
    private readonly messages: Message[]
    private SendTimer: {
        mid: number,
        timer: NodeJS.Timer
    } | null

    constructor(name: string, connection: Connection, postMessage: PostMessage, postMessageCallback: PostMessageCallback, group?: string) {
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

    public setGroup(group: string) {
        if (group) {
            this.group = group
        }
    }

    /**
     * 添加一条消息到等待推送队列
     * @param message 
     */
    public push(message: Message): void {
        this.messages.push(message)
        this.autoPush()
    }

    /**
     * 自动从推送队列获取条消息推送
     * 超时情况下将会由定时器再次调用自身
     * 确认回复的情况下将由ws抛出的回复事件调用该方法并清除定时器和将该消息从消息队列除去
     */
    private autoPush(): void {
        if (!this.SendTimer && this.messages.length > 0) {
            const message = this.messages[0]
            message.setClientStatus(this, 'wait')
            this.send({
                cmd: 'MESSAGE',
                data: message.toWebSocketData()
            })
            this.SendTimer = {
                mid: message.mid,
                timer: setTimeout(() => {
                    // 响应超时
                    message.setClientStatus(this, 'timeout')
                    setTimeout(() => {
                        this.SendTimer = null
                        this.autoPush()
                    }, config.PUSH_INTERVAL)
                }, config.PUSH_TIMEOUT)
            }
        }
    }

    /**
     * 仅负责将消息内容发送到connection监听的encodeMessage事件
     * @param data 
     */
    private send(data: WebSocketMessage.Packet): void {
        this.connection.emit('encodeMessage', data)
    }

    /**
    * websocket接收到消息会调用该方法
    * @param packet 
    */
    private WebSocketClientMessage(packet: WebSocketMessage.Packet): void {
        if (packet.cmd === 'MESSAGE') {
            const data: WebSocketMessage.MessageDataFromClient = <WebSocketMessage.MessageDataFromClient>packet.data
            const message = new Message(data.sendType, data.target, { method: 'webscoket', name: this.name }, data.message.text, data.message.desp)
            // 交给总线选择推送目标并推送
            // 异步返回推送结果
            this.postMessage(message).then((status) => {
                this.send({
                    cmd: 'MESSAGE_REPLY',
                    data: status
                })
            })
        } else if (packet.cmd === 'MESSAGE_CALLBACK') {
            const data: WebSocketMessage.MessageCallbackData = <WebSocketMessage.MessageCallbackData>packet.data
            if (this.SendTimer && this.SendTimer.mid === data.mid) {
                // 如果SendTimer不存在,或与等待中的mid不相同,则表示已超时,不进入if忽略该回复
                this.clearMessage(data.mid)
                clearTimeout(this.SendTimer.timer)
                this.SendTimer = null
                this.autoPush()

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
                this.messages[index].setClientStatus(this, 'ok')
                this.messages.splice(index, 1)
                break
            }
        }
    }
}