# 本文主要写 websocket 协议下数据包的类型及作用

全部使用 json 字符串方式传送，发送前先格式化成 json 字符串（JSON.stringify()），收到服务器的包先格式化为对象（JSON.parse()）

## 认证流程

[]里面写的是数据包的类型，详细结构见下面一点

client open connection
client 发送 token[client AUTH packet]
server 回复认证结果[server AUTH packet]
client 根据[server AUTH packet]判断认证是否成功

## 数据包类型及作用

数据包根据发送方分为 client 和 server 包  
相同类型不同发送方的包结构不一定相同  
例如[client AUTH packet]和[server AUTH packet]是不一样的

## client 包

由 client 发向服务器的包

### 1、AUTH

连接 websocket 后第一个需要发送的包，用于认证和注册身份

```javascript
{
  cmd: "AUTH",
  data: {
    token: string,
    name: string,
    group: string
  }
}
```

### 2、MESSAGE

向其他客户端发送信息

```javascript
{
  cmd: "MESSAGE",
  data: {
    sendType: "personal" | "group", // 单发 | 组发
    target: string,// 单发就是目标的name，组发则为目标的group
    message: {
      text: string,
      desp: string,
      extra: {} // 没有额外消息建议传入空对象
    }
  }
}
```

### 3、MESSAGE_CALLBACK

当接受到服务器发送过来的 MESSAGE 包时，需要使用这个包回复接收到的 MID

```javascript
{
  cmd: "MESSAGE_CALLBACK",
  data: {
    mid: string // 接受到的MESSAGE的mid
  }
}
```

### 4、REGISTER_FCM

注册 FCM

```javascript
{
  cmd: "REGISTER_FCM",
  data: { // 这个对象在chrome可以通过pushManager.subscribe获得
    endpoint: string
    expirationTime: null
    keys: {
      auth: string
      p256dh: string
    }
  }
}
```

### 5、PING

如果是像浏览器这种自带 websocket 客户端却不支持 ping 方法的环境，可以使用这个包代替 websocket 协议中的 ping，服务端会返回 PONG 包

```javascript
{
  cmd: "PING";
}
```

## server 包

由 server 发向客户端的包

### 1、AUTH

连接 websocket 后第一个需要发送的包，用于认证和注册身份

```javascript
{
  cmd: "AUTH",
  data: {
    code: 200|401|403,// 认证成功|尚未认证|认证失败
    auth?: string,// 一个token,在某些包或post请求可能会用到
    msg: string,// 提示信息
    fcmServerKey?: string// 用于注册FCM的服务端公钥,base64编码,pushManager.subscribe的第二个参数
  }
}
```

### 2、MESSAGE

接收的消息,接受到该包一定要马上回复一个 MESSAGE_CALLBACK 包确认消息,否则服务器会在一定时间后一直重发该包

```javascript
{
  cmd: "MESSAGE",
  data: {
    sendType: "personal" | "group" // 单发|组发
    target: string // 单发就是目标的name，组发则为目标的group
    from: {
      method: 'http' | 'websocket',// 发送该消息的方法
      name: string // 发送该消息的人
    }
    mid: string // 消息id,消息唯一标识,用于发送MESSAGE_CALLBACK包
    message: { // 消息主体
      text: string,
      desp: string,
      extra: {}
    }
  }
}
```

### 3、MESSAGE_REPLY

当使用 websocket 发送了一个 MESSAGE 包时,服务端会在一定时间内通过这个包回复推送结果

```javascript
{
  cmd: "MESSAGE_REPLY",
  data: {
    mid: string,
    status: {
      [target name]: "ready" | "ok" | "wait" | "fcm-wait" | "fcm-ok" | "fcm-ok-comfirm" | "no"
    }
  }
}
```

### 4、INFO

普通的提示消息,如当服务端未提供 fcm 服务时会返回改消息提示客户端

```javascript
{
  cmd: "INFO",
  data: string
}
```

### 5、PONG

当收到 PING 包时的回复

```javascript
{
  cmd: "PONG";
}
```
