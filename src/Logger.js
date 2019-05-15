const config = require("./_config.js")

class Logger {
  constructor(namespace) {
    this.namespace = namespace
  }
  notice(data) {
    this._print('Notice', data)
  }
  debug(data) {
    if(config.DEBUG){
      this._print('Debug', data)
    }
  }
  _print(level, text) {
    if(typeof text === 'string' || typeof text === 'number' || typeof text === 'boolean' || typeof text === 'undefined' || text === null){
      console.log(`[${Logger.format(new Date(),'HH:mm:ss')}][${this.namespace}][${level}]${text}`)
    }
    else{
      console.log(`[${Logger.format(new Date(),'HH:mm:ss')}][${this.namespace}][${level}]`)
      console.log(text)
    }

  }
  static format(time, format) {
    let t = new Date(time);                                                //format(time, 'yyyy/MM/dd HH:mm:ss');
    let tf = function (i) { return (i < 10 ? '0' : '') + i };
    return format.replace(/yyyy|MM|dd|HH|mm|ss|DD/g, function (a) {
      switch (a) {
        case 'yyyy':
          return tf(t.getFullYear());
        case 'MM':
          return tf(t.getMonth() + 1);
        case 'mm':
          return tf(t.getMinutes());
        case 'dd':
          return tf(t.getDate());
        case 'HH':
          return tf(t.getHours());
        case 'ss':
          return tf(t.getSeconds());
      }
    })
  }
}
module.exports = Logger