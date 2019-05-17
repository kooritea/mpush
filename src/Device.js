const Log = new (require("./Logger.js"))("Device")

class Device {
  constructor({connection,name=null}){
    this.connection = connection
    this.isConnection = false
    this.isAuthenticated = false //是否已验证
    this._hasNewConnection = false
    this.name = name
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
    if(this.isConnection && this.msgList.length){
      this._push(JSON.stringify({
        cmd: "MESSAGE",
        data: {
          msgList: pushList
        }
      }))
      Log.debug(`[${this.name}][send]`)
      Log.debug(pushList)
    }
  }
  setName(name){
    this.name = name
  }
  sendMsgCb({midList}){
    if(!Array.isArray(midList)) throw (new Error("the SENDMSG_CB midList is not a Array"))
    for(let msg of this.msgList){
      if(midList.includes(String(msg.mid))){
        Log.debug(`[${this.name}][msgcb]${msg.mid}`)
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