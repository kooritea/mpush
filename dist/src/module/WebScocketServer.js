"use strict";
/**
 * Websocket Server
 * create 2019/8/1
 * 负责管理websocket连接和认证
 * 新认证的连接会提交到ClientManager创建客户端对象
 * 已认证的连接发送的消息会decode后通过decodeMessage传递到ClientManager
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
class WebSocketServer {
    constructor(port = 2245, token, clientManager) {
        this.token = token;
        this.server = new ws_1.Server({ port });
        this.clientManager = clientManager;
        this.server.on('connection', this.newConnection.bind(this));
    }
    newConnection(connection) {
        let isAuth = false;
        let timeout = setTimeout(() => {
            if (!isAuth) {
                connection.close();
            }
        }, 30000);
        connection.on('message', (originData) => {
            try {
                const packet = this.decode(originData);
                if (isAuth && packet.cmd !== 'AUTH') {
                    // 外部监听decodeMessage获取解码后的packet
                    connection.emit('decodeMessage', packet);
                }
                else {
                    if (packet.cmd === 'AUTH') {
                        const data = packet.data;
                        if (data.token === this.token && data.name) {
                            clearTimeout(timeout);
                            isAuth = true;
                            this.clientManager.putWebSocketClient(data.name, connection, data.group);
                            // 监听encodeMessage事件接受外部消息,编码后发送
                            connection.on('encodeMessage', (data) => {
                                connection.send(this.encode(data));
                            });
                            connection.send(this.encode({
                                cmd: 'AUTH',
                                data: {
                                    code: 200,
                                    msg: 'Successful authentication'
                                }
                            }));
                        }
                        else {
                            connection.send(this.encode({
                                cmd: 'AUTH',
                                data: {
                                    code: 403,
                                    msg: 'Token invalid'
                                }
                            }));
                        }
                    }
                    else {
                        connection.send(this.encode({
                            cmd: 'AUTH',
                            data: {
                                code: 403,
                                msg: 'Not Auth'
                            }
                        }));
                    }
                }
            }
            catch (e) {
                console.error(e);
            }
        });
        connection.on('ping', () => {
            connection.pong();
        });
    }
    decode(data) {
        try {
            let result = JSON.parse(data);
            if (result.cmd && typeof result.data === 'object') {
                return result;
            }
            else {
                throw new Error("The Packet Is Not A WebSocketMessage");
            }
        }
        catch (e) {
            throw new Error("The Packet Is Not A WebSocketMessage");
        }
    }
    encode(data) {
        return JSON.stringify(data);
    }
}
exports.default = WebSocketServer;
//# sourceMappingURL=WebScocketServer.js.map