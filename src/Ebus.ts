import { EventEmitter } from "events";
import { Message } from "./model/Message.model";
import { Client } from "./model/Client";
import * as WebPush from "web-push"

export class Ebus {

  private emitter: EventEmitter = new EventEmitter()


  on(event: 'server-ready', listener: () => void): void;

  /**
   * 接收到客户端想要发送的消息  
   * 拥有发送Message机能的server订阅(on)  
   * 拥有接收Message机能的server发布(emit)
   * @param event 'message-start'
   * @param listener 
   */
  on(event: 'message-start', listener: (message: Message) => void): void;

  /**
   * 收到接收方的接收确认,只代表某个接受方的状态  
   * MessageManager订阅(on),server发布(emit)
   * @param event 
   * @param listener 
   */
  on(event: 'message-client-status', listener: (payload: {
    mid: string,
    name: string,
    status: MessageStatus
  }) => void): void;

  /**
   * 推送完成，所有接受方已接收消息或未找到接收方消息结束  
   * 一般只有发送方监听该事件  
   * server订阅(on),MessageManager发布(emit)
   * @param event 
   * @param listener 
   */
  on(event: 'message-end', listener: (payload: {
    message: Message,
    status: TypeObject<MessageStatus>
  }) => void): void;
  on(event: 'register-webpush', listener: (payload: {
    client: Client,
    pushSubscription: WebPush.PushSubscription
  }) => void): void;
  on(event: 'register-fcm', listener: (payload: {
    client: Client,
    token: string
  }) => void): void;
  on(event: 'message-webpush-callback', listener: (payload: {
    mid: string,
    name: string
  }) => void): void;
  on(event: 'message-fcm-callback', listener: (payload: {
    mid: string,
    name: string
  }) => void): void;
  on(event: 'unregister-client', listener: (payload: {
    client: Client
  }) => void): void;
  on(event: string, listener: (payload: any) => void): void {
    this.emitter.on(event, listener)
  }

  emit(event: 'server-ready'): void;
  emit(event: 'message-start', message: Message): void;
  emit(event: 'message-client-status', payload: {
    mid: string,
    name: string,
    status: MessageStatus
  }): void;
  emit(event: 'message-end', payload: {
    message: Message,
    status: TypeObject<MessageStatus>
  }): void;
  emit(event: 'register-webpush', payload: {
    client: Client,
    pushSubscription: WebPush.PushSubscription
  }): void;
  emit(event: 'register-fcm', payload: {
    client: Client,
    token: string
  }): void;
  emit(event: 'message-webpush-callback', payload: {
    mid: string,
    name: string
  }): void;
  emit(event: 'message-fcm-callback', payload: {
    mid: string,
    name: string
  }): void;
  emit(event: 'unregister-client', payload: {
    client: Client
  }): void;
  emit(event: string, payload?: any): void {
    this.emitter.emit(event, payload)
  }
}
