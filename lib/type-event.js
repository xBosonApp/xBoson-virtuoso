
var event = {
  // 中止运行, 目标不要拦截这个事件
  STOP                  : 1,

  // 当 STOP 被发出时, 内核通过这个事件调用终止处理器, 无事件参数
  // 插件不应该使用这个事件, 而是通过 Interactive.onStop()
  STOP_HANDLE           : 100,

  // 当目标完成, interactive.runOver 被调用后发出这个消息
  // 由系统发出并由系统接收, 只在本目标中传播, 程序不要拦截和删除会造成内存泄漏
  TARGET_OVER           : 8,

  // 因发生错误而终止运行, 目标不要拦截这个事件, 第一个参数是错误对象
  ERROR                 : 2,

  // 从错误中恢复, 组件可以选择接受这个事件, 以从错误的点继续运行
  // 第一个参数: rcb() 恢复时被调用
  RECOVER_ERROR         : 9,

  // 当一个任务没有后续可执行目标时会(由引擎)发出这个消息, FOR, 事务程序拦截
  END                   : 3,

  // 当数据输出器开始更新数/插入/删除据时, 需要带上数据库连接对象
  BEGIN_UPDATE          : 4,

  // 当更新失败时发出的消息, 第一个参数是操作完成后的回调函数
  UPDATE_FAIL           : 5,

  // 发送统计信息, 正式运行时由系统接收
  STATISTICS            : 6,

  // 强制写出统计信息到日志, 之后不再接受统计信息
  STATISTICS_END        : 600,

  // 一个功能需要两个组件完成时(比如 HTTP), 接收组件发送这个消息到起始组件
  // 第一个参数是应答数据
  SERVEICE_RESPONSE     : 7,

  // 扩展日志, 告知读取行数, 只接受一次, 第一个参数结构: {msg, rows}
  // 正式运行时由系统接收
  L_EX_ROWCOUNT         : 601,

  // 扩展日志, 写出业务日志错误消息, 第一个参数结构: {msg, data, line}
  // 正式运行时由系统接收 [未使用]
  L_EX_BIZLOG           : 602,

  // 当 ESB 服务接收请求时被触发, 第一个参数结构: {msg, time, request_id}
  SERVICE_BEG_LOG       : 603,

  // 当 ESB 服务应答一个请求结束后被触发, 第一个参数结构: {msg, time, request_id}
  SERVICE_END_LOG       : 604,

  0 : 0
};

module.exports = event;
