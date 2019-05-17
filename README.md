# Mpush

## 基于websocket的即时消息推送服务(server端)

> 类似[server酱](http://sc.ftqq.com)的消息推送服务

## 一、配置

### 1、老规矩首先安装依赖
```bash
npm i
```
### 2、配置

```javascript
//config.js
module.exports = {
  TOKEN: 'mpush',
  WS_PORT: 2245,
  HTTP_PORT: 2246,
  DEBUG: false,
  REGISTERS: ["test"]
}
```

- TOKEN
> 用于验证用户身份，滚键盘设置一个即可

- WS_PORT
> websocket监听端口 ws://127.0.0.1:2245  
用户接受消息客户端连接的端口

- HTTP_PORT
> http监听端口 http://127.0.0.1:2246
> http用于向客户端推送消息  
例如：GET http://127.0.0.1:2246?title=testmsg  
下面会详细说明

- debug
> 打印更多日志

- registers
> 预注册设备  
下面会说明

### 配置nginx(可选)

#### ws反向代理
```config
server {
  listen 443 ssl http2;
  server_name domain.com;
  ...
  # https/wss
  ssl_certificate "";
  ssl_certificate_key ""
  ssl_session_cache shared:SSL:1m;
  ssl_session_timeout  10m;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  location /mpush {
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    #连接超时时间，300s内没有数据来往断开连接
    proxy_read_timeout 300;
    proxy_pass   http://127.0.0.1:2245;
  }
}
```
连接
> wss://domain.com/mpush

#### http代理

方式一 部分路径代理

```config
server {
  listen 443 ssl http2;
  server_name domain.com;
  ...
  # https/wss
  ssl_certificate "";
  ssl_certificate_key ""
  ssl_session_cache shared:SSL:1m;
  ssl_session_timeout  10m;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  location /sendmsg/ {
    proxy_pass   http://127.0.0.1:2245/;
  }
}
```
向kooritea设备发送信息  
> GET https://domain.com/sendmsg/kooritea?title=test

---

方式二 全路径代理

```config
server {
  listen 443 ssl http2;
  server_name domain.com;
  ...
  # https/wss
  ssl_certificate "";
  ssl_certificate_key ""
  ssl_session_cache shared:SSL:1m;
  ssl_session_timeout  10m;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  location / {
    proxy_pass   http://127.0.0.1:2245;
  }
}
```
向kooritea设备发送信息  
> GET https://domain.com/kooritea?title=test

## 二、运行项目
```bash
npm start
```
或者

```bash
node main.js
```

## 三、推送消息到客户端

### GET方法和POST方法
只有title和content字段

注意

使用GET方法要注意对非英文内容encodeURI   

> GET http://127.0.0.1/kooritea?title=encodeURI("测试标题")

使用POST方法只能使用x-www-form-urlencoded格式

响应
> ok: 表示设备已经成功收到推送
> online: 表示设备在线，但未在指定时间内回复
> offline: 表示设备不在线，但已保留消息，等待设备连接  
> no: 表示设备未注册，该消息会被丢弃  

## 四、websocket通信协议（客户端开发用）

除了ping包和pong包  
所有数据都使用字符串

推送和回复都是JSON格式，需要客户端自行序列化

### 1、TOKEN认证
打开websocket连接后第一个数据包就是token字符串  
打开连接后30s内未发送TOKEN服务端会主动断开连接

```javascript
ws.onopen=function(){
  ws.send(TOKEN)
}
```
如果TOKEN认证成功
```javascript
{
  "cmd": "AUTH",
  "data": {
    "code": 200,
    "msg": "Successful authentication"
  }
}
```
不成功
```javascript
{
  "cmd": "AUTH",
  "data": {
    "code": 403,
    "msg": "Token invalid"
  }
}
```
### 2、注册设备
TOKEN认证后直接发送设备标识  
TOKEN认证后30s内未发送设备标识服务端会主动断开连接
```javascript
ws.send(DEVICE_ID)
```
服务端响应
```javascript
{
  "cmd": "LOGIN",
  "data":{
    "name": DEVICE_ID
  }
}
```
之后通过这个设备标识向客户端发送消息  
例如
> GET http://127.0.0.1/${DEVICE_ID}?title=mymsg

- 一旦注册设备，在服务端不重启的情况下，即使设备离线，也会保留要推送的消息，等到设备重新连接后再进行推送，确保消息推送到客户端
- 在配置文件中的REGISTERS字段进行预注册，则在设备第一次连接之前就会保留未发送的消息
- 向没有注册的设备推送消息时消息会丢失

### 3、消息协议
推送消息
服务端 -> 客户端
```javascript
{
  "cmd": "MESSAGE", //: String
  "data": { //: Object
    "msgList": [ //: ObjectArray
      {
        "title": '开播通知_高槻律_', //: String
        "content": '', //: String
        "mid": "1557901952810" //: String
      } 
    ]
  }
}
```
mid是接受HTTP请求时的时间戳，可以直接格式化成时间表示消息的推送时间，也是该消息的唯一标识

---
客户端收到消息后的回复
客户端 -> 服务端
```javascript
{
  "cmd": "SENDMSG_CB", //: String
  "data": { //: Object
    "midList": [ //: StringArray
      "1557901952810"
    ]
  }
}
```
客户端接收消息推送后，需要回复每条消息的mid，告知服务端消息已收到，否则服务端会重发该消息

4、心跳设置

- 服务端不显式设置心跳时间(如果使用了nginx代理ws，按照nginx的设置) 
- 服务端不会向客户端发送ping(0x9)包
- 客户端发送ping(0x9)包服务端会马上回复pong(0xA)包
- 当有两个相同设备ID的连接被建立时，第一个连接会被主动断开(在线的话)
- 客户端可以根据客户端实际情况发送ping(0x9)包保持连接

##　五、客户端示例代码（浏览器）
```javascript
var client = new WebSocket("ws://127.0.0.1:2245")
var TOKEN = "mpush"
var DEVICE_ID = "test"
client.onopen=function(){
  client.send(TOKEN)//TOKEN
}
client.onmessage=function(wsres){
  let { cmd,data } = JSON.parse(wsres.data)
  switch(cmd){
    case "AUTH":
      let {code,msg} = data
      if(code === 200){
        client.send(DEVICE_ID)
      }
      console.log(msg)
      break
    case "LOGIN":
      let {name} = data
      console.log(`Login: ${name}`)
      break
    case "MESSAGE":
      let {msgList} = data
      let midList = []
      console.log(`${msgList.length}条来自服务器的消息：`)
      msgList.forEach((item)=>{
        console.log(`title: ${item.title}`)
        console.log(`content: ${item.content}`)
        console.log(`mid: ${item.mid}`)
        console.log()
        midList.push(item.mid)
      })
      client.send(JSON.stringify({
        cmd: "SENDMSG_CB", //: String
        data: { //: Object
          midList
        }
      }))
      break
  }
}
```
发送消息
```bash
curl http://127.0.0.1:2246/test?title=mytitle&content=mycontent
```
因为浏览器没有ping方法，可以手动发送0x9，或者发送任意消息保持连接