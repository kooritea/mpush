const querystring = require('querystring');
const Log = new (require("./Logger.js"))("bodyparser")

module.exports = function(headers,raw){
  let result = {}
  let contentType = headers['content-type']
  try{
    if(/www-form-urlencoded/.test(contentType)){
      result = querystring.parse(raw)
    } else if(/json/.test(contentType)){
      result = JSON.parse(raw)
    } else {
      Log.debug("指定格式外的post请求体：" + contentType)
    }
  }catch(e){
    Log.debug("post请求体解析失败")
    Log.debug(e)
  }
  return result
}