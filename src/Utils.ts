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

const tf = function (i: number): string {
  return (i < 10 ? "0" : "") + i;
};

export function formatDate(date?: Date, format: string = 'yyyy-MM-dd HH:mm:ss') {
  const _date = date ? new Date(date) : new Date()
  return format.replace(/yyyy|MM|dd|HH|mm|ss|DD/g, (a) => {
    switch (a) {
      case "yyyy":
        return tf(_date.getFullYear());
      case "MM":
        return tf(_date.getMonth() + 1);
      case "mm":
        return tf(_date.getMinutes());
      case "dd":
        return tf(_date.getDate());
      case "HH":
        return tf(_date.getHours());
      case "ss":
        return tf(_date.getSeconds());
      case "DD":
        switch (_date.getDay()) {
          case 1:
            return '星期一'
          case 2:
            return '星期二'
          case 3:
            return '星期三'
          case 4:
            return '星期四'
          case 5:
            return '星期五'
          case 6:
            return '星期六'
          case 0:
            return '星期日'
        }
      default:
        return ''
    }
  });
}