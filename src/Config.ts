import * as _Config from '../config.json'

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
  }
}