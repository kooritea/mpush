const http = require('http');
const {parse} = require('url');
const querystring = require('querystring');

const WebsocketServer = require("./src/Websocket.js")
const Device = require("./src/Device.js")
const responseManager = new (require("./src/ResponseManager.js"))()
const Log = new (require("./src/Logger.js"))("main")
const config = require("./src/_config.js")

const devices = [] //通过身份验证的用户

//预注册用户
config.REGISTERS.forEach((item)=>{
  let device = new Device({name: item})
  device.isAuthenticated = true
  devices.push(device)
  Log.notice(`预注册：${item}`)
})
new WebsocketServer({
  port: config.WS_PORT,
  connectioncb: (connection)=>{
    let device = new Device({connection})
    let TimeoutId = setTimeout(function(){
      Log.debug(`30s内未验证token，连接关闭`)
      connection.close()
    }, 30000)
    let TimeoutId2 = null //登录timeout
    connection.on('close',()=>{
      Log.debug(`[${device.name}]连接关闭`)
      device.close()
    })
    connection.on('ping',()=>{
      if(device.isAuthenticated){
        Log.debug(`[${device.name}]ping`)
        connection.pong()
      }
    })
    connection.on('message',(data)=>{
      if(!device.isAuthenticated){
        if(data === config.TOKEN){
          clearTimeout(TimeoutId)
          device.isAuthenticated = true
          connection.send(JSON.stringify({
            cmd: "AUTH",
            data: {
              code: 200,
              msg: "Successful authentication"
            }
          }))
          TimeoutId2 = setTimeout(()=>{
            Log.debug(`30s内未登录，连接关闭`)
            connection.close()
          },30000)
        }else{
          Log.debug("收到错误的token: " + data)
          connection.send(JSON.stringify({
            cmd: "AUTH",
            data: {
              code: 403,
              msg: "Token invalid"
            }
          }))
        }
      }else if(!device.name){
        clearTimeout(TimeoutId2)
        let isRegister = false
        for(let item of devices){
          if(item.name === data){
            device = item
            device.setNewConnection(connection)
            isRegister = true
            Log.notice("login: " + data)
            break
          }
        }
        if(!isRegister){
          Log.notice("register: " + data)
          devices.push(device)
          device.setName(data)
        }
        device.isConnection = true
        connection.send(JSON.stringify({
          cmd: "LOGIN",
          data:{
            name: data
          }
        }))
        //注册完成
        device._nextPush()
      }else{
        try{
          let json = JSON.parse(data)
          switch(json.cmd){
            case "SENDMSG_CB" :
              // {
              //   cmd: "SENDMSG_CB",
              //   data: {
              //     midList: []
              //   }
              // }
              device.sendMsgCb(json.data)//推送消息后客户端的反馈
              responseManager.msgCallback(json.data)
              break
            default :
              Log.debug(`[${device.name}]${data}`)
          }
        }
        catch(e){
          //json格式化失败，忽略该数据包
          console.log(e)
          console.log(data)
        }
      }
    })
  }
})

async function sendData(name,data,response){
  let status = "no"
  data.content = data.content?data.content:""
  data.mid=(new Date()).valueOf() + ""
  Log.debug("[http]" + name)
  Log.debug("[http]" + JSON.stringify(data))
  let isRegister = false
  devices.forEach((device)=>{
    if(device.name === name){
      isRegister = true
      if(device.isConnection){
        status = "online"
        responseManager.addResponse(data.mid,status,response)
      }else{
        status = "offline"
        response.end(status + "\n")
      }
      device.send(data)
    }
  })
  if(!isRegister){
    response.end(status + "\n")
  }
}

http.createServer(function(request, response){
  let params = parse(request.url, true)
  let name = params.pathname.slice(1)
  response.writeHead(200);
  if(request.method === 'GET'){
    let {title,content} = params.query
    sendData(name,{title,content},response)
  }else if (request.method === "POST"){
    let raw = ""
    request.on("data",function(chunk){
      raw += chunk
    })
    request.on("end",function(){
      raw  = decodeURI(raw);
      let {title,content} = querystring.parse(raw)
      sendData(name,{title,content},response)
    })
  }else{
    response.writeHead(405);
    response.end("no\n");
  }
}).listen(config.HTTP_PORT);

Log.notice("ws listen on: " + config.WS_PORT)
Log.notice("http listen on: " + config.HTTP_PORT)