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

    constructor() {
        this.sendType = 'personal'
        this.target = ''
        this.text = ''
        this.desp = ''
        this.mid = (new Date()).valueOf()
    }
    public verify(): boolean {
        return !!this.text || !!this.desp
    }
}