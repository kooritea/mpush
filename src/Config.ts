import * as FS from 'fs'
import * as Path from 'path'
import { Logger } from './Logger'

const logger: Logger = new Logger('Config')

let _Config:any = null
for(let filePath of [`${__dirname}/../config.local.json`,`${__dirname}/../config.json`]){
  const resolveFilePath = Path.resolve(filePath)
  if(FS.existsSync(resolveFilePath)){
    _Config = JSON.parse(FS.readFileSync(resolveFilePath, 'utf8'))
    logger.info(`Use ${resolveFilePath}`)
    break
  }
}
if(!_Config){
  throw new Error('Not found config file')
}
export interface IConfig {
  token: string,
  http: {
    verifyToken: boolean,
    cors: boolean,
    port: number,
    waitTimeout: number
  },
  websocket: {
    verifyToken: boolean,
    port: number,
    authTimeout: number,
    retryTimeout: number,
    waitTimeout: number
  },
  webhook: {
    retryTimeout: number,
    clients: Array<{
      url: string
      method: string
      name: string
      group: string
      proxy: string
    }>,
    proxy: string
  },
  webpush: {
    apiKey: string,
    proxy: string
    retryTimeout: number
  },
  fcm: {
    account: {
      type: string,
      project_id: string
      private_key_id: string
      private_key:string
      client_email:string
      client_id: string
      auth_uri:string
      token_uri:string
      auth_provider_x509_cert_url: string
      client_x509_cert_url:string
      universe_domain:string
    },    
    proxy:string
    retryTimeout: number
  }
}

export const Config:IConfig = {
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
    account: _Config?.fcm?.account,
    proxy: _Config?.fcm?.proxy,
    retryTimeout: Math.max(_Config?.fcm?.retryTimeout, 5000)
  }
}