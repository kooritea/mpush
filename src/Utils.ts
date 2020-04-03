import { ClientSocketPacket } from "./model/ClientSocketPacket"
import { ServerSocketPacket } from "./model/ServerSocketPacket"

type Data = string | Buffer | ArrayBuffer | Buffer[]

export function decodeSocketData(data: Data): ClientSocketPacket {
  if (typeof data === 'string') {
    return new ClientSocketPacket(JSON.parse(data))
  } else if (typeof data === 'object') {
    return new ClientSocketPacket(data)
  } else {
    throw new Error('SocketData must typeof string')
  }
}

export function encodeSocketData(data: ServerSocketPacket): Data {
  return JSON.stringify(data)
}