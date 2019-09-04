# websocket客户端开发文档

所有数据均以JSON字符串方式传递  
实际上预留了encode和decode方法方便之后扩展加密解密

## 一、认证流程

打开连接后发送的第一个数据包就是认证包

group为可选项

```javascript
// request
{
    cmd: 'AUTH',
    data: {
        token: 'your token',
        name: 'onlyone',
        group?: 'groupname'
    }
}
```
---

成功响应

```javascript
// response
{
    cmd: 'AUTH',
    data: {
        code: 200,
        msg: 'Successful authentication'
    }
}
```

失败响应

```javascript
// response
{
    cmd: 'AUTH',
    data: {
        code: 403,
        msg: 'Token invalid'
    }
}
```

认证失败后可以继续发送认证包,直到认证成功  
30s内未认证的连接将会被断开

---

当有两个name相同的连接时,第一个连接会被断开

---

未认证直接发送消息包会返回401请求认证包

```javascript
// response
{
    cmd: 'AUTH',
    data: {
        code: 401,
        msg: 'Need Auth'
    }
}
```

## 二、客户端接收消息推送

### 1、接收消息

```javascript
// server -> client
{
    cmd: 'MESSAGE',
    data: {
        sendType: "personal" | "group",
        target: name | group name,
        from: {
            method: 'websocket' | 'curl',
            name: name | 'anonymous'
        },
        mid: timestamp,
        message: {
            text: string,
            desp: string
        }
    }
}
```

一个websocket包只包含一条消息  

|key | 意义 | 可能的值|
|------|---|---|
|sendType | 单发 \| 组发 | "personal" \| "group"|
|target | 目标标识 | 单发的时候是客户端的name,组发的时候是group name|
|mid | 消息生成的时间,也是消息的唯一标识 | timestamp|
|message | 若如果desp或text为空,则该字段为空字符串 | { text: string, desp: string }|

### 2、确认消息

客户端接收到推送的消息后,需要在${config.PUSH_TIMEOUT}时间内回复mid告知服务器消息已送达  
否则服务器会在超时之后等待${config.PUSH_INTERVAL}时间再次发送该消息

```javascript
// client -> server
{
    cmd: 'MESSAGE_CALLBACK',
    data: {
        mid: timestamp
    }
}
```

### 3、注意

网络状况极差的时候可能会出现服务器没有收到'MESSAGE_CALLBACK'包的情况，导致重新发送，客户端需要注意服务器发送的消息是否与最后一条的mid相同  
假如发现服务器重复发送了消息，需要响应服务器最后一次发送的消息的mid，确认消息送达让服务器发送下一条消息

## 三、客户端推送信息到其他客户端

### 1、发送MESSAGE包到服务器

```javascript
// client -> server
{
    cmd: 'MESSAGE',
    data: {
        sendType: "personal" | "group",
        target: name | group name,
        message: {
            text: string,
            desp: string
        }
    }
}
```

和接收消息的结构基本相同,只是没有mid和from字段

### 2、推送结果

服务器会在${config.PUSH_TIMEOUT}时间内返回推送结果

```javascript
{
    cmd: 'MESSAGE_REPLY',
    data: {
        "client1 name": "ready",
        "client2 name": "ok",
        "client3 name": "no",
        "client4 name": "wait",
        "client5 name": "timeout",
    }
}
```

data字段会包含所有目标,没有推送目标时为 data:{}

|status | 意义|
|------|---|
|ready | 消息队列中还有未发送的消息,正在等待前面的消息推送完成|
|ok | 推送成功|
|no | 推送失败,没有找到该客户端(只会出现在一对一推送)|
|wait | 正在等待回复确认|
|timeout | 首次推送超过时间未回复确认,该消息会等待重发|