import { EventEmitter } from "events";
import { Message } from "./model/Message.model";

export class Ebus {

  private emitter: EventEmitter = new EventEmitter()

  /**
   * 接收到客户端想要发送的消息  
   * 拥有发送Message机能的server订阅(on)  
   * 拥有接收Message机能的server发布(emit)
   * @param event 'message-start'
   * @param listener 
   */
  on(event: 'message-start', listener: (message: Message) => void): void;

  /**
   * 收到接收方的接收确认  
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
   * 推送完成，所有目标已接收消息  
   * server订阅(on),MessageManager发布(emit)
   * @param event 
   * @param listener 
   */
  on(event: 'message-end', listener: (payload: {
    message: Message,
    status: TypeObject<MessageStatus>
  }) => void): void;
  on(event: string, listener: (payload: any) => void): void {
    this.emitter.on(event, listener)
  }

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
  emit(event: string, payload: any): void {
    this.emitter.emit(event, payload)
  }
}
