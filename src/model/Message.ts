/**
 * Message
 * create 2019/7/31
 * 中央处理的唯一对象
 * 接收的所有外部消息都会转换成该对象
 * 一个对象仅包含一条信息
 */

import EventEmitter from 'events'
import Client from './Client';

export default class Message extends EventEmitter {
    public sendType: 'personal' | 'group'
    public target: string
    public text: string
    public desp: string
    public readonly mid: number
    private readonly status: {
        [name: string]: 'ready' | 'ok' | 'no' | 'wait' | 'timeout'
    }
    // 记录是否所有客户端的状态都更新了

    constructor(sendType: 'personal' | 'group' = 'personal', target: string = '', text: string = '', desp: string = '') {
        super()
        this.sendType = sendType
        this.target = target
        this.text = text
        this.desp = desp
        this.mid = (new Date()).valueOf()
        this.status = {}

    }
    public verify(): boolean {
        return !!this.text || !!this.desp
    }

    /**
     * 将目标客户端添加到消息体中
     * 并初始化推送状态为'wait'
     * @param client 
     */
    public addClient(client: Client): void {
        this.status[client.name] = 'ready'
    }

    /**
     * 设置推送失败的客户端
     * 只会用于一对一推送时
     * @param name 
     */
    public setFailedClient(name: string): void {
        this.status[name] = 'no'
    }

    /**
     * 改变该消息推送目标的接收状态
     * @param client 
     * @param status 
     */
    public setClientStatus(client: Client, status: 'ok' | 'no' | 'wait' | 'timeout') {
        this.status[client.name] = status

        let allOk = true
        for (let name of Object.keys(this.status)) {
            if (this.status[name] !== 'ok') {
                allOk = false
                break
            }
        }
        if (allOk) {
            this.emit('PushComplete', this.status)
        }
    }

    /**
     * 获取所有目标客户端的推送状态
     * 不管是否所有状态都更新了
     */
    public getStatus(): { [name: string]: 'ready' | 'ok' | 'no' | 'wait' | 'timeout' } {
        return this.status
    }
}