/**
 * Client Manager
 * create 2019/8/1
 * 客户端管理器
 * 添加或更新客户端对象
 * 收集客户端发送的消息并回调到主线
 */


import Client from "../model/Client";
import WebSocketClient from "../model/WebSocketClient";
import WebHookClient from "../model/WebHookClient";
import { Connection } from "ws";
import { WebHookClientConfig, PostMessage, PostMessageCallback } from "../../typings";
import Message from "../model/Message";

export default class ClientManager {

    private readonly clients: Client[]
    private readonly websocketClients: WebSocketClient[]
    private readonly webhookClients: WebHookClient[]
    // 设备发出的推送请求回调
    private readonly postMessage: PostMessage
    // 设备收到推送后反馈回调
    private readonly postMessageCallback: PostMessageCallback


    /**
     * 客户端消息发送和接收的管理类
     * @param webHookClientConfig webhook配置
     * @param postMessage [callback]客户端的推送请求,当该方法返回promise时,不会等待
     * @param postMessageCallback [callback]消息推送到客户端后返回的推送确认,当该方法返回promise时,不会等待
     */
    constructor(webHookClientConfig: WebHookClientConfig[], postMessage: PostMessage, postMessageCallback: PostMessageCallback) {
        this.clients = []
        this.websocketClients = []
        this.webhookClients = []

        this.postMessage = postMessage
        this.postMessageCallback = postMessageCallback

        this.initWebHookClient(webHookClientConfig)
    }
    /**
     * 传入webhook配置初始化webhook客户端
     * @param webHookClientConfig 配置文件
     */
    private initWebHookClient(webHookClientConfig: WebHookClientConfig[]): void {
        for (const config of webHookClientConfig) {
            const webHookClient = new WebHookClient(config.NAME, config.METHOD, config.URL, this.postMessageCallback, config.GROUP)
            this.clients.push(webHookClient)
            this.webhookClients.push(webHookClient)
        }
    }

    /**
     * 有新的websocket连接时会调用此方法
     * 根据name参数更新设备连接
     * 若该name设备不存在,则创建
     * @param name 
     * @param connection 与客户端的连接实体
     * @param group 
     */
    public putWebSocketClient(name: string, connection: Connection, group?: string): void {

        for (const websocketClient of this.websocketClients) {
            if (websocketClient.name === name) {
                websocketClient.setConnection(connection)
                if (group) {
                    websocketClient.setGroup(group)
                }
                return
            }
        }
        const websocketClient: WebSocketClient = new WebSocketClient(name, connection, this.postMessage, this.postMessageCallback, group)
        this.clients.push(websocketClient)
        this.websocketClients.push(websocketClient)
    }

    /**
     * 根据message对象指定的target将消息分配到对应的客户端类
     * @param message 
     */
    public sendMessage(message: Message): void {
        let hasClient: boolean = false
        if (message.sendType === 'personal') {
            for (const client of this.clients) {
                if (client.name === message.target) {
                    message.addClient(client)
                    client.push(message)
                    hasClient = true
                    break
                }
            }
        } else if (message.sendType === 'group') {
            for (const client of this.clients) {
                if (client.group === message.target) {
                    message.addClient(client)
                    client.push(message)
                    hasClient = true
                }
            }
        }
        if (!hasClient) {
            message.emit('PushComplete', message.getStatus())
        }
    }
}