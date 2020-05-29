import { Ebus } from "./Ebus";
import { Message } from "./model/Message.model";
import { AuthServerSocketPacket } from "./model/ServerSocketPacket";
import { Context } from "./Context";

/**
 * 负责管理一对一消息和多对一消息  
 * 监听到一对一消息的message-client-status事件马上发布message-end  
 * 监听到一对多消息的message-client-status事件  
 * 管理所有客户端的接收状态,适当时机发送message-end事件
 * 保存消息副本
 */
export class MessageManager {
  /**
   * mid -> {Message,Map<namesStaus>}
   */
  private readonly midMap: Map<string, {
    message: Message,
    namesStaus: Map<string, MessageStatus>
  }> = new Map()

  constructor(
    private readonly context: Context,
    private readonly ebus: Ebus
  ) {
    this.ebus.on('message-start', (message) => {
      this.onMessageStart(message)
    })
    this.ebus.on('message-client-status', ({ name, mid, status }) => {
      this.onMessageClientStatus(name, mid, status)
    })
    this.ebus.on('message-end', ({ message }) => {
      this.onMessageEnd(message)
    })
  }

  private onMessageStart(message: Message) {
    if (message?.sendType === 'personal') {
      // 当target未通过user-register注册时
      // 立即抛出message-end事件结束message生命周期
      if (this.context.clientManager.hasClient(message.target)) {
        let namesStaus = new Map()
        namesStaus.set(message.target, 'ready')
        this.midMap.set(message.mid, {
          message,
          namesStaus
        })
      } else {
        this.ebus.emit('message-end', {
          message,
          status: {
            [message.target]: 'no'
          }
        })
      }
    }
    if (message?.sendType === 'group') {
      let clients = this.context.clientManager.getClientByGroup(message.target)
      if (clients.length) {
        let namesStaus = new Map<string, MessageStatus>()
        // 初始化该消息的目标的状态,储存在midMap
        for (let client of clients) {
          namesStaus.set(client.name, 'ready')
        }
        this.midMap.set(message.mid, {
          message,
          namesStaus
        })
      } else {
        this.ebus.emit('message-end', {
          message,
          status: {}
        })
      }
    }
  }
  /**
   * 修改某条消息对应的target的状态  
   * 一旦目标的推送状态变为ok则不可再改变  
   * 当全部为ok时发送message-end事件
   * @param name 
   * @param mid 
   * @param status 
   */
  private onMessageClientStatus(name: string, mid: string, status: MessageStatus) {
    const midItem = this.midMap.get(mid)
    if (midItem && midItem.namesStaus.has(name)) {
      if (midItem.namesStaus.get(name) !== 'ok') {
        // 像FCM这种不可靠推送会出现迟于webscoket推送返回状态的情况
        // 所以一旦推送状态变为ok则不可再改变
        midItem.namesStaus.set(name, status)
      }
      // 检查是否所有状态都为ok
      let statusObject: TypeObject<MessageStatus> = {}
      for (let state of midItem.namesStaus) {
        statusObject[state[0]] = state[1]
        if (state[1] !== 'ok') {
          return
        }
      }
      this.ebus.emit('message-end', {
        message: midItem.message,
        status: statusObject
      })
    }
  }
  private onMessageEnd(message: Message) {
    this.midMap.delete(message.mid)
  }

  /**
   * 获取消息推送状态,一般用于超时设置  
   * 正常情况下消息的所有推送目标确认推送后会抛出message-end事件  
   * 当前方法是一定时间内未接收到message-end事件强制获取message状态
   * @param mid 
   */
  getMessageStatus(mid: string): TypeObject<MessageStatus> {
    const midItem = this.midMap.get(mid)
    if (midItem) {
      let statusObject: TypeObject<MessageStatus> = {}
      for (let state of midItem.namesStaus) {
        statusObject[state[0]] = state[1]
      }
      return statusObject
    } else {
      return {}
    }
  }
}