"use strict";
/**
 * WebHookClient
 * create 2019/8/1
 * 消息首次进入messages队列,待当前事件循环结束后马上发送messages中的所有消息
 * 并进入waitMessage队列
 *
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const Client_1 = __importDefault(require("./Client"));
const _config_1 = __importDefault(require("../_config"));
const axios = axios_1.default.create({
    timeout: _config_1.default.PUSH_TIMEOUT
});
class WebHookClient extends Client_1.default {
    constructor(name, method, url, postMessageCallback, group) {
        super(name, group);
        this.method = method;
        this.url = url;
        this.postMessageCallback = postMessageCallback;
        this.messages = [];
        this.sendLock = false;
    }
    /**
     * 外部调用的send方法
     * 发送失败或响应格式错误会进入failMessages队列等待重发
     * @param message
     */
    push(message) {
        this.messages.push(message);
        this.autoPush();
    }
    autoPush() {
        if (!this.sendLock && this.messages.length > 0) {
            this.sendLock = true;
            const message = this.messages[0];
            message.setClientStatus(this, 'wait');
            this.curl(message).then((response) => {
                if (/^[0-9]+$/.test(response.data)) {
                    const mid = Number(response.data);
                    this.clearMessage(mid);
                    message.setClientStatus(this, 'ok');
                    this.postMessageCallback(Number(response.data));
                    this.sendLock = false;
                    this.autoPush();
                }
                else {
                    message.setClientStatus(this, 'timeout');
                    setTimeout(() => {
                        this.sendLock = false;
                        this.autoPush();
                    }, _config_1.default.PUSH_INTERVAL);
                }
            }).catch((e) => {
                message.setClientStatus(this, 'timeout');
                setTimeout(() => {
                    this.sendLock = false;
                    this.autoPush();
                }, _config_1.default.PUSH_INTERVAL);
            });
        }
    }
    curl(message) {
        return (new Promise((resolve) => {
            switch (this.method) {
                case 'GET':
                    resolve(axios.get(this.url, {
                        params: {
                            token: _config_1.default.TOKEN,
                            mid: message.mid,
                            text: message.text,
                            desp: message.desp
                        }
                    }));
                    break;
                case 'POST':
                    resolve(axios.post(this.url, {
                        token: _config_1.default.TOKEN,
                        mid: message.mid,
                        text: message.text,
                        desp: message.desp
                    }));
                    break;
            }
        }));
    }
    /**
     * 删除已确认送达的消息
     * @param mid
     */
    clearMessage(mid) {
        for (let index = 0; index < this.messages.length; index++) {
            if (this.messages[index].mid === mid) {
                this.messages.splice(index, 1);
                break;
            }
        }
    }
}
exports.default = WebHookClient;
//# sourceMappingURL=WebHookClient.js.map