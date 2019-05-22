const WebSocketServer = require('ws').Server

class Websocket {
  constructor({textcb,connectioncb,closecb,errorcb,port}){
    this.server = null
    this.userTextcb = textcb
    this.userConnectioncb = connectioncb
    this.userClosecb = closecb
    this.userErrorcb = errorcb
    this.port = port || 2245
    this.wss = new WebSocketServer({ port: this.port });
    this.createServer()
  }
  createServer(){
    this.wss.on("connection",(connection)=>{
      this.connectioncb(connection)
      connection.on('message', this.textcb.bind(this))
      connection.on('close', this.closecb.bind(this))
      connection.on('error', this.errorcb.bind(this))
    })
  }
  sendAll(data){
    this.server.connections.forEach((connection)=>{
      connection.send(data)
    })
  }
  close(){
    this.server.close()
  }
  textcb(result){
    if(typeof this.userTextcb === "function"){
      this.userTextcb(result)
    }
  }
  connectioncb(connection){
    if(typeof this.userConnectioncb === "function"){
      this.userConnectioncb(connection)
    }
  }
  closecb(code){
    if(typeof this.userClosecb === "function"){
      this.userClosecb(code)
    }
  }
  errorcb(code){
    if(typeof this.userErrorcb === "function"){
      this.userErrorcb(code)
    }
  }
}


module.exports = Websocket