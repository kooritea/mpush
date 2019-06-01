const nowDiff = function(timestamp){//计算某个时间与当前时间相差的距离
  let now = (new Date()).valueOf()
  let subtract = now - timestamp
  if(subtract < 1000){
    return `${subtract}ms`
  } else if(subtract <= 60000){
    return `${parseInt(subtract/1000)}s`
  } else if(subtract <= 3600000){
    let min = subtract / 60000
    let sec = subtract % 60000
    return `${parseInt(min)}min${parseInt(sec/1000)}s`
  }
}
module.exports = {
  nowDiff
}