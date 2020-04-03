import { Ebus } from "./Ebus";
import { Message } from "./model/Message.model";

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
  /**
   * group name -> Set<name>
   */
  private readonly groupMap: Map<string, Set<string>> = new Map()
  private readonly nameSet: Set<string> = new Set()
  constructor(
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
    this.ebus.on('user-register', ({ name, group }) => {
      console.log(`[user-register]: name: ${name}${group ? ',group: ' + group : ''}`)
      this.onUserRegister(name, group)
    })
  }

  private onMessageStart(message: Message) {
    if (message?.sendType === 'personal') {
      // 当target未通过user-register注册时
      // 立即抛出message-end事件结束message生命周期
      if (this.nameSet.has(message.target)) {
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
      let names = this.groupMap.get(message.target)
      if (names) {
        let namesStaus = new Map<string, MessageStatus>()
        // 初始化该消息的目标的状态,储存在midMap
        for (let name of names) {
          namesStaus.set(name, 'ready')
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
  private onMessageClientStatus(name: string, mid: string, status: MessageStatus) {
    const midItem = this.midMap.get(mid)
    if (midItem) {
      midItem.namesStaus.set(name, status)
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
  private onUserRegister(name: string, group: string) {
    if (group !== "") {
      let groupSet = this.groupMap.get(group)
      if (groupSet) {
        groupSet.add(name)
      } else {
        this.groupMap.set(group, new Set<string>([name]))
      }
    }
    this.nameSet.add(name)
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