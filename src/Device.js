const Log = new (require("./Logger.js"))("Device")
const { nowDiff } = require("./public.js")

class Device {
  constructor({connection,name=null}){
    this.connection = connection
    this.isConnection = false
    this.isAuthenticated = false //是否已验证
    this._hasNewConnection = false
    this.name = name
    this.loginTimestamp = 0
    this.msgList = [
      // {
      //   mid: string,
      //   title: string,
      //   content: string
      //   sended: boolean
      //   timeoutId: int
      // }  
    ]
  }
  send(data){
    // data = {
    //   mid: string,
    //   title: string,
    //   content: string
    // }
    data.sended = false
    data.timeoutId = null
    this.msgList.push(data)
    this._nextPush()
  }
  _push(data){
    this.connection.send(data)
  }
  _nextPush(){
    let pushList = []
    this.msgList.forEach((item)=>{
      if(!item.sended){
        pushList.push({
          title: item.title,
          content:item.content,
          mid: item.mid
        })
        item.sended = true
        item.timeoutId = setTimeout(()=>{
          item.sended = false
        },2000)
      }
    })
    if(this.isConnection && pushList.length){
      this._push(JSON.stringify({
        cmd: "MESSAGE",
        data: {
          msgList: pushList
        }
      }))
      Log.notice(`[${this.name}][send]`)
      Log.notice(pushList)
    }
  }
  setName(name){
    this.name = name
  }
  sendMsgCb({midList}){
    if(!Array.isArray(midList)) throw (new Error("the SENDMSG_CB midList is not a Array"))
    for(let msg of this.msgList){
      if(midList.includes(String(msg.mid))){
        Log.notice(`[${this.name}][msgcb]${msg.mid}`)
        Log.notice(`[${this.name}]消息推送用时: ${nowDiff(msg.mid)}`)
        clearTimeout(msg.timeoutId)
        setTimeout(()=>{
          let index = this.msgList.indexOf(msg)
          this.msgList.splice(index,1)
        })
      }
    }
  }
  close(oldConnection){
    if(!this._hasNewConnection){
      Log.notice("logout: " + this.name)
      Log.notice(`在线时长: ${nowDiff(this.loginTimestamp)}`)
      this.isConnection = false
      if(this.connection){
        oldConnection.close()
      }
    }
    this._hasNewConnection = false
  }
  setNewConnection(connection){
    if(this.connection && this.isConnection){
      this.connection.close()
      this._hasNewConnection = true
    }
    this.connection = connection
    this.isConnection = true
  }
}

module.exports = Device