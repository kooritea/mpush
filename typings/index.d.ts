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
        cmd: 'AUTH' | 'MESSAGE_CALLBACK' | 'MESSAGE' | 'MESSAGE_REPLY',
        data: AuthData | AuthReplyData | MessageCallbackData | MessageData | MessageDataFromClient | MessageDataFromClientReply
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
    /**
     * cmd: MESSAGE_CALLBACK
     * direction: 客户端->服务端
     * 客户端收到推送消息返回的推送确认
     */
    interface MessageCallbackData {
        mid: number
    }
    /**
     * cmd: MESSAGE
     * direction: 服务端->客户端
     * 服务器推送消息到客户端
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
     * cmd: MESSAGE
     * direction: 客户端->服务端
     * 服务器接收客户端发送的推送请求,没有mid字段
     */
    interface MessageDataFromClient {
        sendType: 'personal' | 'group',
        target: string,
        message: {
            text: string,
            desp: string
        }
    }

    /**
     * cmd: MESSAGE_REPLY
     * direction: 服务端->客户端
     * 接收到客户端的推送请求后返回给客户端的推送情况
     */
    interface MessageDataFromClientReply {
        [name: string]: 'ready' | 'ok' | 'no' | 'wait' | 'timeout'
    }
}

interface WebHookClientConfig {
    NAME: string,
    GROUP?: string,
    URL: string,
    METHOD: 'GET' | 'POST'
}

/**
 * 将推送请求传递到总线的回调方法
 */
interface PostMessage {
    (message: Message): Promise<{
        [name: string]: 'ready' | 'ok' | 'no' | 'wait' | 'timeout'
    }>
}
/**
 * 将推送确认信息传递到总线的回调方法
 */
interface PostMessageCallback {
    (mid: number): void
}