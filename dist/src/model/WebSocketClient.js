"use strict";
/**
 * WebSocketClient
 * create 2019/8/1
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = __importDefault(require("./Client"));
const _config_1 = __importDefault(require("../_config"));
const Message_1 = __importDefault(require("./Message"));
class WebSocketClient extends Client_1.default {
    constructor(name, connection, postMessage, postMessageCallback, group) {
        super(name, group);
        this.connection = connection;
        this.postMessage = postMessage;
        this.postMessageCallback = postMessageCallback;
        this.messages = [];
        this.SendTimer = null;
        this.setConnection(connection);
    }
    setConnection(connection) {
        if (this.connection !== connection) {
            this.connection.close();
            this.connection.removeAllListeners('decodeMessage');
            this.connection.removeAllListeners('encodeMessage');
        }
        this.connection = connection;
        this.connection.on('decodeMessage', this.WebSocketClientMessage.bind(this));
    }
    setGroup(group) {
        if (group) {
            this.group = group;
        }
    }
    /**
     * 添加一条消息到等待推送队列
     * @param message
     */
    push(message) {
        this.messages.push(message);
        this.autoPush();
    }
    /**
     * 自动从推送队列获取条消息推送
     * 超时情况下将会由定时器再次调用自身
     * 确认回复的情况下将由ws抛出的回复事件调用该方法并清除定时器和将该消息从消息队列除去
     */
    autoPush() {
        if (!this.SendTimer && this.messages.length > 0) {
            const message = this.messages[0];
            message.setClientStatus(this, 'wait');
            this.send({
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
            });
            this.SendTimer = {
                mid: message.mid,
                timer: setTimeout(() => {
                    // 响应超时
                    message.setClientStatus(this, 'timeout');
                    setTimeout(() => {
                        this.SendTimer = null;
                        this.autoPush();
                    }, _config_1.default.PUSH_INTERVAL);
                }, _config_1.default.PUSH_TIMEOUT)
            };
        }
    }
    /**
     * 仅负责将消息内容发送到connection监听的encodeMessage事件
     * @param data
     */
    send(data) {
        this.connection.emit('encodeMessage', data);
    }
    /**
    * websocket接收到消息会调用该方法
    * @param packet
    */
    WebSocketClientMessage(packet) {
        if (packet.cmd === 'MESSAGE') {
            const data = packet.data;
            const message = new Message_1.default(data.sendType, data.target, data.message.text, data.message.desp);
            // 交给总线选择推送目标并推送
            // 异步返回推送结果
            this.postMessage(message).then((status) => {
                this.send({
                    cmd: 'MESSAGE_REPLY',
                    data: status
                });
            });
        }
        else if (packet.cmd === 'MESSAGE_CALLBACK') {
            const data = packet.data;
            if (this.SendTimer && this.SendTimer.mid === data.mid) {
                // 如果SendTimer不存在,或与等待中的mid不相同,则表示已超时,不进入if忽略该回复
                this.clearMessage(data.mid);
                clearTimeout(this.SendTimer.timer);
                this.SendTimer = null;
                this.autoPush();
                this.postMessageCallback(data.mid);
            }
        }
    }
    /**
     * 删除等待队列中已确认送达的消息
     * @param mid
     */
    clearMessage(mid) {
        for (let index = 0; index < this.messages.length; index++) {
            if (this.messages[index].mid === mid) {
                this.messages[index].setClientStatus(this, 'ok');
                this.messages.splice(index, 1);
                break;
            }
        }
    }
}
exports.default = WebSocketClient;
//# sourceMappingURL=WebSocketClient.js.map