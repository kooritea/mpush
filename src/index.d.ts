interface TypeObject<T> {
  [key: string]: T
}
/**
 * ready 正在送信队列排队
 * ok 送达,对端已确认
 * wait 已发送,等待对端确认
 * fcm-wait 已通过FCM发送,等待对端确认
 * fcm-ok 对端已确认fcm消息送达(不代表消息送达)
 * no 未找到该消息要发送的目标
 */
type MessageStatus = 'ready' | 'ok' | 'wait' | 'fcm-wait' | 'fcm-ok' | 'no'