import HttpServer from './module/HttpServer'
import config from './_config'

new HttpServer(config.HTTP_PORT, async function (message) {
    console.log(message)
    return { status: 200, responseBody: '233' }
})
