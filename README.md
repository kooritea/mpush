# Mpush 2.1

## 功能

mpush 是一套致力于用最简单,最快速的方式把消息从任何地方推送到指定的人的终端的系统,就像[server 酱](http://sc.ftqq.com/3.version)一样  
只不过接收消息的不是微信而是任何可以建立 websocket 的客户端,就像下一点提到的安卓客户端,又或者是 http 服务器(webhook 方式),亦或者 WebPush

## 安卓客户端仓库

[mpush-android-client(2.x)](https://github.com/kooritea/mpush-android-client/tree/2.x)

- 已经可以使用,功能正在完善中
- 2.x 版本 mpush 需要配合使用 2.x 版本的 mpush-android-client

## 通用客户端仓库

[mpush-pwa-client](https://github.com/kooritea/mpush-pwa-client)

- 支持 pwa
- 支持在安卓手机上使用 WebPush 推送（在安卓上为 fcm）

## 新特性

- 使用 typescript 重新编写
- 新增一对多按组推送
- 新增 webhook 的接入方式
- 新增 websocket 客户端双向传递消息
- 新增 WebPush 接入方式(2.1)

## 一、安装

- ### 稳定版

在[发布页](https://github.com/kooritea/mpush/releases)下载并解压
仅需要 ndoe 环境(建议使用 LTS 10.16.2 或以上版本)

```bash
npm install --production

# 按需修改完配置文件后运行
npm run start
```

---

- ### 开发版

```bash
git clone https://github.com/kooritea/mpush.git
cd mpush
npm install

# 按需修改完配置文件后运行
npm run dev
```

## 二、配置

直接编辑根目录的 config.json
2.1 和 2.0 已有有较大幅度变化

```javascript
{
  "token": "test",
  "http": {
    "verifyToken": false, // 验证token,token位置为http头的authorization字段
    "port": 9093,
    "waitTimeout": 5000, //等待客户端答复的最长时间,超时后会返回目标客户端的接受状态
    "cors": true, // 是否允许跨域请求
  },
  "websocket": {
    "verifyToken": true, // websocket连接起始阶段的AUTH指令是否验证token
    "port": 9094,
    "authTimeout": 30000, // 时间内未验证成功将会断开socket
    "retryTimeout": 3000, // 时间内未收到socket客户端的消息确认会重新发送
    "waitTimeout": 5000  // 使用socket客户端向其他客户端发送消息时,等待其他客户端答复的最长时间,超时后会返回目标客户端的接受状态
  },
  "webhook": {
    "retryTimeout": 3000,//时间内未收到2xx状态码会重新发送
    "clients": [
      {
        "name": "wh1",
        "group": "group2",
        "url": "http://127.0.0.1:8089/",
        "method": "GET", // 请求体下面补充
        // "proxy": { // 代理设置,可以在clients内对单个客户端设置,也可以在webhook.proxy统一设置
        //   "host": "127.0.0.1",
        //   "port": 12333,
        //   "auth": {
        //     "username": "string",
        //     "password": "string"
        //   },
        //   "protocol": "http"
        // }
      }
    ],
    // "proxy": {
    //   "host": "127.0.0.1",
    //   "port": 12333,
    //   "auth": {
    //     "username": "string",
    //     "password": "string"
    //   },
    //   "protocol": "http"
    // }
  },
  "webpush": {
    "serverKey": "", // WebPushserverKey,获取方式下面补充
    "proxy": "http://127.0.0.1:12333",// http代理
    "retryTimeout": 10000 // 向WebPush服务器发送请求等待时间,超时未成功会重试
  }
}
```

## 三、使用方式

### 1、客户端接入方式

#### (1) websocket

具体接入方式的实现由客户端实现，仅需要在客户端中填写 name、group、token 即可

#### (2) webhook

收到消息会以 http 请求的方式发送到指定的服务器，配置参考第二点中 webhook 字段

`额外信息(extra)是指text,desp的字段外的字段`
`额外信息可以配合客户端实现例如: 优先级,scheme等功能`

token 存放在 http 头的 authorization 字段

```javascript
// get
// 所有额外信息都会平铺到url上,但额外信息如果是多层对象则不会继续平铺,例如下面的a字段和b字段,b是一个编码的JSON字符串{hello:'world'}

'/mpush?sendType=personal&target=wh1&fromMethod=websock&fromName=anonymous&mid=111111111111&text=text10&desp=desp10&a=233&b=%7B%22hello%22:%22world%22%7D'


// post
// 这里的额外信息会全部放到message.extra字段,没有额外信息字段的时候extra为空对象
{
  cmd: 'MESSAGE',
  data: {
    sendType: "personal" | "group",
    target: name | group name,
    from: {
      method: 'websocket' | 'http',
      name: name | ''
    },
    mid: timestamp,
    message: {
      text: string,
      desp: string,
      extra: {
        a: 233,
        b: {
          hello: 'world'
        }
      }
    }
  }
}

```

`接收到 webhook 请求后 需要返回 2xx的响应码,否则超过设置的时间后会重新发送该消息`

### 2、发送消息

#### (1) 使用 http GET 请求发送消息,GET 方法接收 text 和 desp 两个字段，text 一般用作 title，参考 server 酱,除了 text 和 desp 参数,其他参数都会被放到 extra 字段中返回给接收方

格式

```bash
curl http://${HOST}:${HTTP_PORT}/${name}.${type:'send' | 'group'}?text=${text}&desp=${desp}&a=233&b=%7B%22hello%22:%22world%22%7D
```

其中`type`为`send`的时候 name 为客户端的 name  
为`group`的时候`name`为`group name`,即一对多推送

例如  
向 name 为`kooritea`的客户端推送消息 text 为`hello`,desp 为`world`的消息

```bash
curl http://HOST:HTTP_PORT/kooritea.send?text=hello&desp=world
```

向所有属于`kgroup`组的客户端发送消息

```bash
curl http://HOST:HTTP_PORT/kgroup.group?text=hello&desp=world
```

#### (1) 使用 http POST 请求发送消息,POST 方法接收一个完整的消息包,格式如下

```javascript
{
    cmd: "MESSAGE",
    data : {
      sendType: 'personal' | 'group',
      target: string,
      message: {
        text: string,
        desp: string,
        extra: object
      }
    }
}

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
        "client5 name": "webpush-wait",
        "client5 name": "webpush-ok",
    }
}
```

| status             | 意义                                            |
| ------------------ | ----------------------------------------------- |
| ready              | 正在送信队列排队                                |
| ok                 | 送达,对端已确认                                 |
| no                 | 推送失败,没有找到该客户端(只会出现在一对一推送) |
| wait               | 已发送,等待对端确认                             |
| webpush-wait       | 已通过 WebPush 发送,等待对端确认                |
| webpush-ok         | 已发送 WebPush 消息到 Google(不代表消息送达)    |
| webpush-ok-comfirm | 客户端确认 WebPush 消息送达                     |

#### (2) 通过 websocket 客户端发送推送消息请求

这部分会由客户端实现(具体实现方式可以看下面的开发文档),用户只需要选择目标和内容

## 四、WebPush 接入方式

1. 登录 firebase 控制台  
   [https://console.firebase.google.com/](https://console.firebase.google.com/)

2. 创建一个项目

3. 进入项目
   点击左边的的[齿轮] -> 项目设置 -> 复制 server api key

4. 填写到 mpush config.json 的 webpush.serverKey

## 五、HTTPS

请使用 nginx 等反代服务器  
下面是 nginx 的示例配置

```nginx
http {
  ...
  server {
    listen	     9094 ssl;
    server_name      your.domain.com;

    ssl_certificate "/etc/nginx/certs/your.domain.com.cer";
    ssl_certificate_key "/etc/nginx/certs/your.domain.com.key";
    ssl_session_cache shared:SSL:32768;
    ssl_session_timeout  10m;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_protocols        TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
    server_tokens off;

    location /mpush {
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Host $host;
      proxy_read_timeout 300;
      #mpush websocket path and port
      proxy_pass   http://127.0.0.1:9094;
    }
  }
}

```

## 六、客户端开发

[通信方式（2.0）](./CLIENT_DEV.md)  
[通信方式（2.1）](./CLIENT_DEV_2.1.md)
