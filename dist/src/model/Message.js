"use strict";
/**
 * Message
 * create 2019/7/31
 * 中央处理的唯一对象
 * 接收的所有外部消息都会转换成该对象
 * 一个对象仅包含一条信息
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
class Message extends events_1.default {
    // 记录是否所有客户端的状态都更新了
    constructor(sendType = 'personal', target = '', text = '', desp = '') {
        super();
        this.sendType = sendType;
        this.target = target;
        this.text = text;
        this.desp = desp;
        this.mid = (new Date()).valueOf();
        this.status = {};
    }
    verify() {
        return !!this.text || !!this.desp;
    }
    /**
     * 将目标客户端添加到消息体中
     * 并初始化推送状态为'wait'
     * @param client
     */
    addClient(client) {
        this.status[client.name] = 'ready';
    }
    /**
     * 改变该消息推送目标的接收状态
     * @param client
     * @param status
     */
    setClientStatus(client, status) {
        this.status[client.name] = status;
        let allOk = true;
        for (let name of Object.keys(this.status)) {
            if (this.status[name] !== 'ok') {
                allOk = false;
                break;
            }
        }
        if (allOk) {
            this.emit('PushComplete', this.status);
        }
    }
    /**
     * 获取所有目标客户端的推送状态
     * 不管是否所有状态都更新了
     */
    getStatus() {
        return this.status;
    }
}
exports.default = Message;
//# sourceMappingURL=Message.js.map