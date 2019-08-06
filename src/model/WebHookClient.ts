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
import { ClientPostMessageCallback } from "../../typings";

const axios = originAxios.create({
    timeout: 10000
})

export default class WebHookClient extends Client {

    private readonly method: 'GET' | 'POST'
    private readonly url: string
    private postMessageCallback: ClientPostMessageCallback
    private readonly messages: Message[]
    private sendLock: boolean

    constructor(name: string, method: 'GET' | 'POST', url: string, postMessageCallback: ClientPostMessageCallback, group?: string) {
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
    public send(message: Message): void {
        this.messages.push(message)
        this.autoSend()
    }

    private autoSend(): void {
        if (!this.sendLock && this.messages.length > 0) {
            this.sendLock = true
            const message = this.messages[0]
            this.curl(message).then((response: any) => {
                if (/^[0-9]+$/.test(response.data)) {
                    const mid = Number(response.data)
                    this.clearMessage(mid)
                    this.autoSend()
                    this.postMessageCallback(Number(response.data))
                    this.sendLock = false
                } else {
                    setTimeout(() => {
                        this.sendLock = false
                        this.autoSend()
                    }, 10000)
                }
            }).catch((e) => {
                setTimeout(() => {
                    this.sendLock = false
                    this.autoSend()
                }, 10000)
            })
        }
    }

    private curl(message: Message): Promise<any> {
        return (new Promise((resolve) => {
            switch (this.method) {
                case 'GET':
                    resolve(axios.get(this.url, {
                        params: {
                            mid: message.mid,
                            text: message.text,
                            desp: message.desp
                        }
                    }))
                    break;
                case 'POST':
                    resolve(axios.post(this.url, {
                        mid: message.mid,
                        text: message.text,
                        desp: message.desp
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