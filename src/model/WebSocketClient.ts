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
    private SendTimer: NodeJS.Immediate | null

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
            connection.close()
            this.connection.removeAllListeners('decodeMessage')
            this.connection.removeAllListeners('encodeMessage')
        }
        this.connection = connection
        this.connection.on('decodeMessage', this.WebSocketClientMessage.bind(this))
    }

    public send(message: Message): void {
        this.messages.push(message)
        if (!this.SendTimer) {
            this.SendTimer = setImmediate(() => {
                this.sendAll()
                this.SendTimer = null
            })
        }
    }

    public sendAll(): void {
        this.connection.emit('encodeMessage', {
            cmd: 'MESSAGE',
            data: this.messages.map((item: Message) => {
                return {
                    text: item.text,
                    desp: item.desp
                }
            })
        })
    }

    /**
    * websocket接收到消息会调用该方法
    * @param packet 
    */
    private WebSocketClientMessage(packet: WebSocketMessage.Packet): void {
        if (packet.cmd === 'MESSAGE') {
            const data: WebSocketMessage.MessageData = <WebSocketMessage.MessageData>packet.data
            data.messages.forEach((item) => {
                const message = new Message(data.sendType, data.target, item.text, item.desp)
                this.postMessage(message)
            })
        } else if (packet.cmd === 'MESSAGE_CALLBACK') {
            const data: WebSocketMessage.MessageCallbackData = <WebSocketMessage.MessageCallbackData>packet.data
            this.postMessageCallback(data.mids)
        }
    }
}