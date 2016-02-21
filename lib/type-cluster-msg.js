//
// 进程间通讯时, 发送的消息中有 type 属性, 使用这个属性区分消息类型
//
var type = {
  LOG          : 100,
  CORE_MSG     : 200,
  USE_PORT     : 300,
  FREE_PORT    : 301,
  USE_PORT_RET : 302,
};

module.exports = type;