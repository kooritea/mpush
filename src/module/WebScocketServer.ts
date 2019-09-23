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
import Logger from './Logger'

export default class WebSocketServer {

    private readonly token: string
    private readonly server: Server
    private readonly clientManager: ClientManager

    constructor(port: number, token: string, clientManager: ClientManager) {
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
                Logger.debug(packet)
                if (isAuth && packet.cmd !== 'AUTH') {
                    // 外部监听decodeMessage获取解码后的packet
                    connection.emit('decodeMessage', packet)
                } else {
                    if (packet.cmd === 'AUTH') {
                        const data: WebSocketMessage.AuthData = <WebSocketMessage.AuthData>packet.data
                        if (data.token === this.token && data.name) {
                            clearTimeout(timeout)
                            isAuth = true
                            this.clientManager.putWebSocketClient(data.name, connection, data.group)
                            // 监听encodeMessage事件接受外部消息,编码后发送
                            connection.on('encodeMessage', (data) => {
                                connection.send(this.encode(data))
                            })
                            connection.send(this.encode({
                                cmd: 'AUTH',
                                data: {
                                    code: 200,
                                    msg: 'Successful authentication'
                                }
                            }))
                        } else {
                            connection.send(this.encode({
                                cmd: 'AUTH',
                                data: {
                                    code: 403,
                                    msg: 'Token invalid'
                                }
                            }))
                        }
                    } else {
                        connection.send(this.encode({
                            cmd: 'AUTH',
                            data: {
                                code: 401,
                                msg: 'Need Auth'
                            }
                        }))
                    }
                }
            } catch (e) {
                Logger.error(e)
                Logger.debug(originData)
            }
        })
        connection.on('ping', () => {
            connection.pong()
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
    private encode(data: WebSocketMessage.Packet): string {
        return JSON.stringify(data)
    }
}