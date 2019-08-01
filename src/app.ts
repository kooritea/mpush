import HttpServer from './module/HttpServer'
import config from './_config'
import ClientManager from './module/ClientManager';
import Message from './model/Message';
import WebSocketServer from './module/WebScocketServer';

new HttpServer(config.HTTP_PORT, async function (message) {
    console.log(message)
    return { status: 200, responseBody: '233' }
})

const clientManager = new ClientManager(function (message: Message) {
    console.log(message)
}, function (mids: number[]) {
    console.log(mids)
})

new WebSocketServer(config.WEBSOCKET_PORT, config.TOKEN, clientManager)