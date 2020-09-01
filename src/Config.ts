import * as _Config from '../config.json'
import * as FS from "fs"
import * as Path from "path"
import * as WebPush from "web-push"
import { AxiosProxyConfig } from 'axios'
import { Logger } from './Logger'

const logger: Logger = new Logger('Config')

const getVAPIDKeys = function (): {
  publicKey: string,
  privateKey: string
} {
  const keypath = Path.resolve(__dirname, '../keys')
  try {
    const keys = JSON.parse(FS.readFileSync(keypath).toString())
    return keys
  } catch (e) {
    logger.warn(`读取本地WebPush秘钥对失败，重新生成到${keypath}`)
    const keys = WebPush.generateVAPIDKeys()
    try {
      FS.writeFileSync(keypath, JSON.stringify(keys))
    } catch (e) {
      logger.warn(`保存WebPush秘钥对到${keypath}失败，下次启动将重新生成`)
    }
    return keys
  }

}

export const Config = {
  token: _Config?.token || "",
  http: {
    port: _Config?.http?.port || 9093,
    verifyToken: _Config?.http?.verifyToken === true || false,
    waitTimeout: Math.max(_Config?.http?.waitTimeout, 500),
    cors: _Config?.http?.cors
  },
  websocket: {
    port: _Config?.websocket?.port || 9093,
    verifyToken: _Config?.websocket?.verifyToken === true || false,
    authTimeout: Math.max(_Config?.websocket?.authTimeout, 100),
    retryTimeout: Math.max(_Config?.websocket?.retryTimeout, 100),
    waitTimeout: Math.max(_Config?.websocket?.waitTimeout, 500)
  },
  webhook: {
    retryTimeout: Math.max(_Config?.webhook?.retryTimeout, 100),
    clients: Array.isArray(_Config?.webhook?.clients) ? _Config?.webhook?.clients : [],
    proxy: _Config?.webhook?.proxy
  },
  webpush: {
    apiKey: _Config?.webpush?.apiKey,
    proxy: _Config?.webpush?.proxy,
    retryTimeout: Math.max(_Config?.webpush?.retryTimeout, 5000),
    vapidKeys: getVAPIDKeys()
  },
  fcm: {
    projectId: _Config?.fcm?.projectId,
    applicationId: _Config?.fcm?.applicationId,
    apiKey: _Config?.fcm?.apiKey,
    serverKey: _Config?.fcm?.serverKey,
    proxy: _Config?.fcm?.proxy,
    retryTimeout: Math.max(_Config?.fcm?.retryTimeout, 5000)
  }
}