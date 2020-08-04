interface TypeObject<T> {
  [key: string]: T
}
/**
 * ready 正在送信队列排队
 * ok 送达,对端已确认
 * wait 已发送,等待对端确认
 * webpush-wait 已通过WebPush发送,等待对端确认
 * webpush-send 已成功发送到google服务器
 * webpush-ok 对端已确认WebPush消息送达(不代表消息送达)
 * no 未找到该消息要发送的目标
 * 
 */
type MessageStatus = 'ready' | 'ok' | 'wait' | 'webpush-wait' | 'webpush-send' | 'webpush-ok' | 'no'