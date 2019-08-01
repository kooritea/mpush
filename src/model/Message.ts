/**
 * Message
 * create 2019/7/31
 * 中央处理的唯一对象
 * 接收的所有外部消息都会转换成该对象
 * 一个对象仅包含一条信息
 */

export default class Message {
    public sendType: 'personal' | 'group'
    public target: string
    public text: string
    public desp: string
    public readonly mid: number

    constructor(sendType: 'personal' | 'group' = 'personal', target: string = '', text: string = '', desp: string = '') {
        this.sendType = sendType
        this.target = target
        this.text = text
        this.desp = desp
        this.mid = (new Date()).valueOf()
    }
    public verify(): boolean {
        return !!this.text || !!this.desp
    }
}