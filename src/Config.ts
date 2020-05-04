import * as _Config from '../config.json'
import { AxiosProxyConfig } from 'axios'
import * as WebPush from "web-push"

export const Config = {
  token: _Config?.token || "",
  http: {
    port: _Config?.http?.port || 9093,
    verifyToken: _Config?.http?.verifyToken === true || false,
    waitTimeout: Math.max(_Config?.http?.waitTimeout, 500),
  },
  websocket: {
    port: _Config?.websocket?.port || 9094,
    verifyToken: _Config?.websocket?.verifyToken === true || false,
    authTimeout: Math.max(_Config?.websocket?.authTimeout, 100),
    retryTimeout: Math.max(_Config?.websocket?.retryTimeout, 100),
    waitTimeout: Math.max(_Config?.websocket?.waitTimeout, 500)
  },
  webhook: {
    retryTimeout: Math.max(_Config?.webhook?.retryTimeout, 100),
    clients: <Array<{
      name: string,
      group: string,
      url: string,
      method: string,
      proxy: AxiosProxyConfig
    }>>(Array.isArray(_Config?.webhook?.clients) ? _Config?.webhook?.clients : []),
    proxy: <AxiosProxyConfig>_Config?.webhook?.proxy
  },
  fcm: {
    serverKey: _Config?.fcm?.serverKey,
    proxy: _Config?.fcm?.proxy,
    retryTimeout: Math.max(_Config?.fcm?.retryTimeout, 5000),
    vapidKeys: WebPush.generateVAPIDKeys()
  }
}