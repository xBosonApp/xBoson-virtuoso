var cluster    = require('cluster');
var logger     = require('logger-lib')('eeb');
var sysconf    = require('configuration-lib').load();
var clus_type  = require('./type-cluster-msg.js');

//
// 日志系统, 可调用函数列表
//
var LOG_FN_NAME = [ 
  'det', 'sta', 'cnt', 'err', 
  'cls', 'srv_beg', 'srv_end',
];

//
// 这个开关为 true 会禁用日志, 减少网络占用
//
var NOT_SEND_DETAIL_LOG_TO_MANAGET = true;
var LOG_INIT = 1;
var OFFSET   = 3;

var ws_client;


//
// 函数约定: 
//
// 1. 调用时参数 ({rc, tbegin, runtimeid, instanceid, __ext})
//    __ext -- 在 mid.js[mid386] 处定义
//
// 2. 返回对象 return { det , sta ... };
//    所有函数的原型: Functin(parm)
//    det -- 每次生成一个详细日志条目, parm:{ his, msg_type }
//    sta -- 最后调用一次, 生成概览日志, parm:{ tend, msg_arr }
//    cnt -- 当第一个组件读取了数据, 告知读取行数, parm:{ time, row_count, msg }
//    err -- 每次调用产生一个错误数据日志, ETL parm:{time, line, rowdata, msg}
//           ESB parm:{time, msg, request_id}
//    cls -- 任务终止, 关闭日志系统
//    srv_beg -- 服务启动, parm:{time, msg, request_id}
//    srv_end -- 服务结束, parm:{time, msg, request_id}
//
module.exports = {
  create              : create_log_sys,
  master_log_listener : master_log_listener,
  set_ws_client       : set_ws_client,
};


function set_ws_client(c) {
  ws_client = c;
}


//
// 日志系统, 负责按照配置启动不同的日志策略
// 导出给 core 使用, 内部不要使用
//
function create_log_sys(parm) {
  var logg;


  if (parm.rc) {
    var rc = parm.rc;
    parm.rc = {};
    // 去掉深层信息
    for (var n in rc) {
      parm.rc[n] = rc[n];
    }
    delete parm.rc.note_text;
    delete parm.rc.targets;
    delete parm.rc.dependent;
  }


  if (cluster.isMaster) {
    logg = use_ws_log(parm);
  } else {
    if (NOT_SEND_DETAIL_LOG_TO_MANAGET) {
      logg = use_local_detail(parm);
    } else {
      logg = use_process_msg(parm);
    }
  }

  return logg;
}


//
// 进程间通讯接收日志, 当集群节点使用 use_process_msg 
// 发送日志, 这个方法接收日志
//
function master_log_listener() {

  cluster.on('fork', function(worker) {
    var _fn = [];

    _fn[ LOG_INIT  ] = function(parm) {
      var wlog = use_ws_log(parm);

      LOG_FN_NAME.forEach(function(n, i) {
        _fn[ i+OFFSET ] = wlog[ n ];
      });
    }

    worker.on('message', function(msg) {
      if (msg.type !== clus_type.LOG) return;
      _fn[ msg.logt ](msg.parm);
    });
  });
}


//
// 详细日志不发送到中心端
//
function use_local_detail(_parm) {
  var _log = logger('eeb-run-log');

  var ret = use_process_msg(_parm);
  
  ret.det = create_print('info');
  ret.cnt = create_print('warn');;
  ret.err = create_print('error');;

  function create_print(type) {
    return function() {
      _log[type].call(_log, arguments);
    }
  }

  return ret;
}


//
// 使用进程间通讯发送日志
//
function use_process_msg(_parm) {
  var ret = {};

  process.send({
    type       : clus_type.LOG,
    logt       : LOG_INIT,
    parm       : _parm,
  });

  LOG_FN_NAME.forEach(function(n, i) {
    create_ps_send_fn(n, i+OFFSET);
  });


  function create_ps_send_fn(name, log_type) {
    ret[name] = function(parm) {
      process.send({
        type     : clus_type.LOG,
        logt     : log_type,
        parm     : parm,
      });
    }
  }

  return ret;
}


//
// 使用 websocket 推送日志到中心端
//
function use_ws_log(_parm) {
  var ret = {};

  log_sys_init();
  LOG_FN_NAME.forEach(create_ws_send_fn);
  ws_client.on('connect', log_sys_init);


  function log_sys_init() {
    ws_client.emit('log_sys_init', _parm);
  }


  function create_ws_send_fn(name) {
    ret[ name ] = function(parm) {
      ws_client.emit('log_sys_' + name, {
        parm      : parm,
        runtimeid : _parm.runtimeid,
      });
    }
  }

  return ret;
}


try {
  NOT_SEND_DETAIL_LOG_TO_MANAGET =
      !(require('./log-sys-status.js') == 0x9834AF);
  logger.log('The running log may send to center.');
} catch(__e) { }
