import * as _Config from '../config.json'

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
    retryTimeout: Math.max(_Config?.webpush?.retryTimeout, 5000)
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