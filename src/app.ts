import HttpServer from './module/HttpServer'
import config from './_config'
import ClientManager from './module/ClientManager';
import WebSocketServer from './module/WebScocketServer';

const clientManager = new ClientManager(config.WEBHOOK_CLIENTS, async (message) => {
    // 客户端发出的推送请求,目前只有websocket客户端可以发出推送请求
    return new Promise((resolve) => {
        message.once('PushComplete', (status) => {
            resolve(status)
        })
        clientManager.sendMessage(message)
        setTimeout(() => {
            resolve(message.getStatus())
        }, 5000)

    })
}, async (mid: number) => {
    // 确认推送成功的mid
    console.log(`已确认推送成功: ` + mid)
})

new HttpServer(config.HTTP_PORT, async (message) => {
    return new Promise((resolve) => {
        message.once('PushComplete', (status) => {
            resolve(status)
        })
        clientManager.sendMessage(message)
        setTimeout(() => {
            resolve(message.getStatus())
        }, 5000)

    })
})


new WebSocketServer(config.WEBSOCKET_PORT, config.TOKEN, clientManager)