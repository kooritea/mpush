/**
 * Client Manager
 * create 2019/8/1
 * 客户端管理器
 * 添加或更新客户端对象
 * 收集客户端发送的消息并回调到主线
 */


import Client from "../model/Client";
import Message from "../model/Message";
import WebSocketClient from "../model/WebSocketClient";
import WebHookClient from "../model/WebHookClient";
import { Connection } from "ws";
import { WebSocketMessage } from "../../typings";

interface ClientPostMessage {
    (message: Message): void
}
interface ClientPostMessageCallback {
    (mids: number[]): void
}

export default class ClientManager {

    private readonly clients: Client[]
    private readonly websocketClients: WebSocketClient[]
    private readonly webhookClients: WebHookClient[]
    // 设备发出的推送请求回调
    private readonly postMessage: ClientPostMessage
    // 设备收到推送后反馈回调
    private readonly postMessageCallback: ClientPostMessageCallback

    /**
     * 所有的设备发出的消息都会转换成Message对象并触发这个postMessage回调方法
     * @param postMessage 
     */
    constructor(postMessage: ClientPostMessage, postMessageCallback: ClientPostMessageCallback) {
        this.clients = []
        this.websocketClients = []
        this.webhookClients = []
        this.postMessage = postMessage
        this.postMessageCallback = postMessageCallback
    }
    /**
     * 根据name参数更新设备连接,并移除旧连接的监听事件
     * 若该name设备不存在,则创建
     * @param name 
     * @param connection 与客户端的连接实体
     * @param group 
     */
    public putWebSocketClient(name: string, connection: Connection, group?: string): void {
        connection.on('decodeMessage', this.WebSocketClientMessage.bind(this))
        for (const websocketClient of this.websocketClients) {
            if (websocketClient.name === name) {
                websocketClient.getConnection().removeAllListeners('decodeMessage')
                websocketClient.getConnection().close()
                websocketClient.setConnection(connection)
                return
            }
        }
        const websocketClient: WebSocketClient = new WebSocketClient(name, connection, group)
        this.clients.push(websocketClient)
        this.websocketClients.push(websocketClient)
    }

    /**
     * websocket接收到消息会调用该方法
     * @param packet 
     */
    private WebSocketClientMessage(packet: WebSocketMessage.Packet) {
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