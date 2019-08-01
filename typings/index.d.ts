import * as events from 'events';
import 'ws'

declare module 'ws' {
    interface Connection extends events.EventEmitter {
        on(event: string | symbol, listener: (...args: any[]) => void): this;

        close(code?: number, data?: string): void;
        ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
        pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
        send(data: any, cb?: (err?: Error) => void): void;
        send(data: any, options: { mask?: boolean; binary?: boolean; compress?: boolean; fin?: boolean }, cb?: (err?: Error) => void): void;
    }
}

declare namespace WebSocketMessage {
    interface Packet {
        cmd: 'login' | 'messageCallback' | 'message',
        data: LoginData | MessageCallbackData | MessageData
    }
    interface LoginData {
        token: string,
        name: string,
        group?: string
    }
    interface MessageCallbackData {
        mids: number[]
    }
    interface MessageData {
        sendType: 'personal' | 'group',
        target: string,
        messages: Array<{
            text: string,
            desp: string
        }>
    }
}