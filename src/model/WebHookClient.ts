/**
 * WebHookClient
 * create 2019/8/1
 */

import axios from 'axios'

import Client from "./Client";
import Message from "./Message";
import { ClientPostMessageCallback } from "../../typings";

export default class WebHookClient extends Client {

    private readonly method: 'GET' | 'POST'
    private readonly url: string
    private postMessageCallback: ClientPostMessageCallback
    private readonly messages: Message[]
    private SendTimer: NodeJS.Immediate | null

    constructor(name: string, method: 'GET' | 'POST', url: string, postMessageCallback: ClientPostMessageCallback, group?: string) {
        super(name, group)
        this.method = method
        this.url = url
        this.postMessageCallback = postMessageCallback
        this.messages = []
        this.SendTimer = null
    }

    public send(message: Message): void {
        this.messages.push(message)
        if (!this.SendTimer) {
            this.SendTimer = setImmediate(() => {
                this.sendAll()
                this.SendTimer = null
            })
        }
    }

    /**
     * 结束这次事件循环后把send收集的全部消息全部发送
     */
    private sendAll(): void {
        for (const message of this.messages) {
            switch (this.method) {
                case 'GET':
                    axios.get(this.url, {
                        params: {
                            text: message.text,
                            desp: message.desp
                        }
                    }).then((response) => {
                        this.postMessageCallback(response.data)
                    })
                    break;
                case 'POST':
                    axios.post(this.url, {
                        text: message.text,
                        desp: message.desp
                    }).then((response) => {
                        this.postMessageCallback(response.data)
                    })
            }
        }
        //  清空数组    
        this.messages.length = 0
    }
}