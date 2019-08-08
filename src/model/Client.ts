import Message from "./Message";

/**
 * Client
 * create 2019/8/1
 * 客户端基类
 */

export default abstract class Client {

    public readonly name: string
    public group?: string

    constructor(name: string, group?: string) {
        this.name = name
        this.group = group
    }

    /**
     * 接收消息但未正真发送
     * @param messages 
     */
    abstract push(messages: Message): void
}