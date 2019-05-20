class ResponseManager {
  constructor(){
    this.list = {//mid作为键的列表

    }
  }
  addResponse(mid,status,response){
    mid = String(mid)
    this.list[mid] = {
      status,
      response,
      timeoutId: null
    }
    this.list[mid].timeoutId = setTimeout(()=>{
      if(this.list[mid]){
        this.list[mid].response.end(this.list[mid].status)
        delete this.list[mid]
      }
    },3000)
  }
  msgCallback({midList}){//
    if(!Array.isArray(midList)) throw (new Error("the SENDMSG_CB midList is not a Array"))
    midList.forEach((mid)=>{
      mid = String(mid)
      if(this.list[mid]){
        let msg = this.list[mid]
        clearTimeout(msg.timeoutId)
        msg.status = "ok"
        msg.response.end(msg.status)
        delete this.list[mid]
      }
    })
  }
}
module.exports = ResponseManager