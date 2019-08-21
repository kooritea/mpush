/**
 * WebHookClient
 * create 2019/8/1
 * 消息首次进入messages队列,待当前事件循环结束后马上发送messages中的所有消息
 * 并进入waitMessage队列
 * 
 */

import originAxios from 'axios'

import Client from "./Client";
import Message from "./Message";
import config from "../_config";

import { PostMessageCallback } from "../../typings";

const axios = originAxios.create({
    timeout: config.PUSH_TIMEOUT
})

export default class WebHookClient extends Client {

    private readonly method: 'GET' | 'POST'
    private readonly url: string
    private postMessageCallback: PostMessageCallback
    private readonly messages: Message[]
    private sendLock: boolean

    constructor(name: string, method: 'GET' | 'POST', url: string, postMessageCallback: PostMessageCallback, group?: string) {
        super(name, group)
        this.method = method
        this.url = url
        this.postMessageCallback = postMessageCallback
        this.messages = []
        this.sendLock = false
    }

    /**
     * 外部调用的send方法
     * 发送失败或响应格式错误会进入failMessages队列等待重发
     * @param message 
     */
    public push(message: Message): void {
        this.messages.push(message)
        this.autoPush()
    }

    private autoPush(): void {
        if (!this.sendLock && this.messages.length > 0) {
            this.sendLock = true
            const message = this.messages[0]
            message.setClientStatus(this, 'wait')
            this.curl(message).then((response: any) => {
                if (/^[0-9]+$/.test(response.data)) {
                    const mid = Number(response.data)
                    this.clearMessage(mid)
                    message.setClientStatus(this, 'ok')
                    this.postMessageCallback(Number(response.data))
                    this.sendLock = false
                    this.autoPush()
                } else {
                    message.setClientStatus(this, 'timeout')
                    setTimeout(() => {
                        this.sendLock = false
                        this.autoPush()
                    }, config.PUSH_INTERVAL)
                }
            }).catch((e) => {
                message.setClientStatus(this, 'timeout')
                setTimeout(() => {
                    this.sendLock = false
                    this.autoPush()
                }, config.PUSH_INTERVAL)
            })
        }
    }

    private curl(message: Message): Promise<any> {
        return (new Promise((resolve) => {
            switch (this.method) {
                case 'GET':
                    resolve(axios.get(this.url, {
                        params: {
                            token: config.TOKEN,
                            sendType: message.sendType,
                            target: message.target,
                            mid: message.mid,
                            text: message.text,
                            desp: message.desp
                        }
                    }))
                    break;
                case 'POST':
                    resolve(axios.post(this.url, {
                        token: config.TOKEN,
                        sendType: message.sendType,
                        target: message.target,
                        mid: message.mid,
                        message: {
                            text: message.text,
                            desp: message.desp
                        }
                    }))
                    break;
            }
        }))
    }

    /**
     * 删除已确认送达的消息
     * @param mid
     */
    private clearMessage(mid: number): void {
        for (let index = 0; index < this.messages.length; index++) {
            if (this.messages[index].mid === mid) {
                this.messages.splice(index, 1)
                break
            }
        }
    }
}