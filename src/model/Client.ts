/**
 * Client
 * create 2019/8/1
 * 客户端基类
 */

export default class Client {

    public readonly name: string
    public readonly group?: string

    constructor(name: string, group?: string) {
        this.name = name
        this.group = group
    }
}