/**
 * WebSocketClient
 * create 2019/8/1
 */

import Client from "./Client";
import { Connection } from "ws";

export default class WebSocketClient extends Client {

    private connection: Connection

    constructor(name: string, connection: Connection, group?: string) {
        super(name, group)
        this.connection = connection
        this.setConnection(connection)
    }
    public setConnection(connection: Connection): void {
        this.connection = connection
    }
    public getConnection(): Connection {
        return this.connection
    }
}