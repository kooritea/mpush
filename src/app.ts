import HttpServer from './module/HttpServer'
import config from './_config'
import ClientManager from './module/ClientManager';
import WebSocketServer from './module/WebScocketServer';

const clientManager = new ClientManager(config.WEBHOOK_CLIENTS, (message) => {
    console.log(message)
}, function (mid: number) {
    console.log(mid)
})

new HttpServer(config.HTTP_PORT, async (message) => {
    clientManager.sendMessage(message)
    return { status: 200, responseBody: 'ok' }
})

new WebSocketServer(config.WEBSOCKET_PORT, config.TOKEN, clientManager)