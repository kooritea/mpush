/**
 * Websocket Server
 * create 2019/8/1
 * 负责管理websocket连接和认证
 * 新认证的连接会提交到ClientManager创建客户端对象
 * 已认证的连接发送的消息会decode后通过decodeMessage传递到ClientManager
 */

import ClientManager from "./ClientManager";
import { Server, Connection } from 'ws'
import { WebSocketMessage } from "../../typings";

export default class WebSocketServer {

    private readonly token: string
    private readonly server: Server
    private readonly clientManager: ClientManager

    constructor(port: number = 2245, token: string, clientManager: ClientManager) {
        this.token = token
        this.server = new Server({ port })
        this.clientManager = clientManager
        this.server.on('connection', this.newConnection.bind(this))
    }
    private newConnection(connection: Connection): void {
        let isAuth: boolean = false
        let timeout: NodeJS.Timer = setTimeout(() => {
            if (!isAuth) {
                connection.close()
            }
        }, 30000)
        connection.on('message', (originData: string) => {
            try {
                const packet: WebSocketMessage.Packet = this.decode(originData)
                if (isAuth && packet.cmd !== 'login') {
                    connection.emit('decodeMessage', packet)
                } else {
                    if (packet.cmd === 'login') {
                        const data: WebSocketMessage.LoginData = <WebSocketMessage.LoginData>packet.data
                        if (data.token === this.token && data.name) {
                            clearTimeout(timeout)
                            isAuth = true
                            this.clientManager.putWebSocketClient(data.name, connection, data.group)
                        }
                    }
                }
            } catch (e) {
                console.error(e)
            }
        })
    }
    private decode(data: string): WebSocketMessage.Packet {
        try {
            let result = JSON.parse(data)
            if (result.cmd && typeof result.data === 'object') {
                return result
            } else {
                throw new Error("The Packet Is Not A WebSocketMessage")
            }
        } catch (e) {
            throw new Error("The Packet Is Not A WebSocketMessage")
        }
    }
}