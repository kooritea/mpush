import * as events from 'events';
import 'ws'
import Message from '../src/model/Message';

declare module 'ws' {
    interface Connection extends events.EventEmitter {
        on(event: 'decodeMessage', listener: (packet: WebSocketMessage.Packet) => void): void
        on(event: 'encodeMessage', listener: (data: WebSocketMessage.Packet) => void): void
        on(event: string | symbol, listener: (...args: any[]) => void): this;

        emit(event: 'encodeMessage', data: WebSocketMessage.Packet): boolean
        emit(event: 'decodeMessage', data: WebSocketMessage.Packet): boolean

        close(code?: number, data?: string): void;
        ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
        pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
        send(data: any, cb?: (err?: Error) => void): void;
        send(data: any, options: { mask?: boolean; binary?: boolean; compress?: boolean; fin?: boolean }, cb?: (err?: Error) => void): void;
    }
}

declare namespace WebSocketMessage {
    interface Packet {
        cmd: 'AUTH' | 'MESSAGE_CALLBACK' | 'MESSAGE',
        data: AuthData | AuthReplyData | MessageCallbackData | MessageData | MessageDataFromClient
    }
    interface AuthData {
        token: string,
        name: string,
        group?: string
    }
    interface AuthReplyData {
        code: number,
        msg: string
    }
    interface MessageCallbackData {
        mid: number
    }
    /**
     * websocket传递的消息对象
     */
    interface MessageData {
        sendType: 'personal' | 'group',
        target: string,
        mid: number,
        message: {
            text: string,
            desp: string
        }
    }
    /**
     * 消息由客户端发往服务器,没有mid字段
     */
    interface MessageDataFromClient {
        sendType: 'personal' | 'group',
        target: string,
        message: {
            text: string,
            desp: string
        }
    }
}

interface WebHookClientConfig {
    NAME: string,
    GROUP?: string,
    URL: string,
    METHOD: 'GET' | 'POST'
}
interface ClientPostMessage {
    (message: Message): void
}
interface ClientPostMessageCallback {
    (mid: number): void
}