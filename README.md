# Mpush 2.0
## 新特性
- 使用typescript重新编写
- 新增一对多按组推送
- 新增webhook的接入方式
- 新增websocket客户端双向传递消息

### 注意,和1.0版本的客户端不通用,适配2.0的客户端还在开发中 :)

## 一、安装
- ### 稳定版  

在[发布页](https://github.com/kooritea/mpush/releases)下载并解压
仅需要ndoe环境(建议使用LTS 10.16.2或以上版本)

---

- ### 开发版

```bash
git clone https://github.com/kooritea/mpush.git
```
需要安装typescript，package的脚本是linux上的，windows需要自行修改

## 二、配置

直接编辑根目录的config.json
* 开发版只需编辑根目录的config.json
* 直接运行dist目录下编译后的应用则需要运行npm run build覆盖配置或手动编辑  

```javascript
{
    "HTTP_PORT":8090, // http服务器监听的地址
    "WEBSOCKET_PORT":8091, // websocket服务器监听的地址
    "TOKEN": "test", // 客户端接入需要与这个token匹配,webhook会带上这个token用于接收方校验
    "WEBHOOK_CLIENTS": [ // webhook配置,不使用可以留空(不要删除中括号[])
        {
            "NAME": "wh1", // 唯一名称,不应该与其他任何客户端同名,否则只有先接入的客户端能接收到消息
            "GROUP": "group2", // 组名,按组推送使用,
            "URL": "http://127.0.0.1:8092/mpush", // 请求地址
            "METHOD": "GET" // 请求方法
        },
        {
            "NAME": "TEST_WEBHOOK_POST",
            "URL": "http://127.0.0.1:8092/mpush",
            "METHOD": "POST"
        }
    ],
    "PUSH_TIMEOUT": 10000, // 等待回复确认的时间,超时未确认将会重发消息
    "PUSH_INTERVAL": 5000, // 重试间隔 推送失败或异常等待多少时间再重发
}
```

## 三、运行

### 1、安装依赖

```bash
npm i
```
### 2、运行

- ### [发布页](https://github.com/kooritea/mpush/releases)下载的稳定版
```bash
node src/app.js
```

---

- ### 直接克隆或下载仓库的开发版
```bash
npm run dev
```

## 四、使用方式

### 1、客户端接入方式

#### (1) websocket

具体接入方式的实现由客户端实现，仅需要在客户端中填写name、group、token即可
#### (2) webhook

收到消息会以http请求的方式发送到指定的服务器，配置参考第二点中WEBHOOK字段

```javascript
// get
'/mpush?token=test&sendType=personal&target=wh1&fromMethod=websock&fromName=anonymous&mid=111111111111&text=text10&desp=desp10'

// post
{
    token: config.TOKEN,
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
```

### 2、发送消息

#### (1) 使用http请求发送消息，可以使用GET和POST方法,接收text和desp两个字段，text一般用作title，参考server酱

格式

```bash
curl http://${HOST}:${HTTP_PORT}/${name}.${type:'send' | 'group'}?text=${text}&desp=${desp}
```

其中`type`为`send`的时候name为客户端的name  
为`group`的时候`name`为`group name`,即一对多推送

例如  
向name为`kooritea`的客户端推送消息text为`hello`,desp为`world`的消息

```bash
curl http://HOST:HTTP_PORT/kooritea.send?text=hello&desp=world
```

向所有属于`kgroup`组的客户端发送消息

```bash
curl http://HOST:HTTP_PORT/kgroup.group?text=hello&desp=world
```
---

```javascript
// response
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
|status | 意义|
|------|---|
|ready | 消息队列中还有未发送的消息,正在等待前面的消息推送完成|
|ok | 推送成功|
|no | 推送失败,没有找到该客户端(只会出现在一对一推送)|
|wait | 正在等待回复确认|
|timeout | 首次推送超过时间未回复确认,该消息会等待重发|

注意: 假如该消息目标未进行第一次连接或未在config定义wenhook,则会默默失效

#### (2) 通过websocket客户端发送推送消息请求

这部分会由客户端实现(具体实现方式可以看下面的开发文档),用户只需要选择目标和内容

## 五、websocket客户端开发

[通信方式](./WSCLIENT_DEV.md)