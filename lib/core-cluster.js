/**
 *  Copyright 2023 Jing Yanming
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
var corelib  = require('./core.js');
var msg_type = require('./type-cluster-msg.js');
var TMAP     = require('./type-eeb.js');
var quit_th  = require('./exit.js');
var cluster  = require('cluster');
var logger   = require('logger-lib')('eeb-cluster');
var Event    = require('events').EventEmitter;



module.exports = {
  createCore    : cluster.isMaster ? createCore : createWork,
  STATE         : corelib.STATE,
  STA_NAME      : corelib.STA_NAME,
  LIMIT         : corelib.LIMIT,
  STATE_WAIT    : corelib.STATE_WAIT,
  IS_TEST       : corelib.IS_TEST,
  HISTORY_LIMIT : corelib.HISTORY_LIMIT,
};


//
// 测试运行时的数据限制
//
var LIMIT         = corelib.LIMIT;
var STATE_WAIT    = corelib.STATE_WAIT;
var IS_TEST       = corelib.IS_TEST;
var SEND_HISTORY  = '-1';


//
// 每个任务使用 cluster 单独创建一个进程
// 透明的实现内核功能, 解决内存溢出问题
//
// 集群时创建真正的内核运行任务
// 主机时作为代理, 与集群内核通讯
//
function createCore() {

  //
  // 创建一个内核用于运行基本测试
  //
  var do_test_core = corelib.createCore();

  var _core = {
    checkRunnerConfig   : do_test_core.checkRunnerConfig,
    test_target         : do_test_core.test_target,

    test                : test,
    run                 : run,
    stop                : stop,

    getHistory          : getHistory,
    getCurrentState     : getCurrentState,
  };

  var __id = 1;
  var event = new Event();

  // _identify : HistoryContent; core.js:getHistoryContent()
  // 在进程退出后保存历史数据
  var his_saver = {};

  // _identify : worker
  var cores = {};

  // __id : rcb
  var rcb_fn_map = {};

  rcb_fn_map[ SEND_HISTORY ] = when_exit_recv_his;


  return _core;


  function when_exit_recv_his(err, hc) {
    his_saver[ hc.runnerId ] = hc;
    event.emit('stoped:' + hc.runnerId, true);
    rcb_fn_map[ SEND_HISTORY ] = when_exit_recv_his;
  }


  //
  // 注册一个回调函数, 函数必须符合 RCB 规范
  //
  function reg_rcb(fn) {
    if (!fn) throw new Error('must function');
    var _id = __id++;
    rcb_fn_map[_id] = fn;
    return _id;
  }


  //
  // 等待任务节点上的消息
  //
  function create_worker(_identify) {
    if (!_identify) throw new Error('_identify not null');

    var worker = cluster.fork();
    cores[ _identify ] = worker;

    //
    // 老大接收节点发来的数据
    // err, data 是参数, fnid 是函数序号
    //
    worker.on('message', function(msg) {
      if (msg.type != msg_type.CORE_MSG) return;

      var rcb = rcb_fn_map[ msg.fnid ];
      if (!rcb) return;
      delete rcb_fn_map[ msg.fnid ];

      var arg1 = msg.err && new Error(msg.err);
      var arg2 = msg.data;
      rcb(arg1, arg2);
    });

    worker.on('exit', function(code, signal) {
      delete cores[ _identify ];
    });

    //
    // 一旦创建了任务节点, 删除本地历史记录
    //
    delete his_saver[ _identify ];
  }


  //
  // 向节点请求函数调用
  // 进程间调用存在进程异常调用超时的情况调用 RCB(err)
  //
  function call_fn(_identify, fn_name, RCB, parms) {
    var worker = cores[_identify];
    if (!worker) {
      return RCB(new Error('任务没有运行'));
    }

    var tid = setTimeout(function() {
      _rcb( new Error('超时') );
    }, STATE_WAIT*2);

    function _rcb(a, b) {
      if (RCB) {
        RCB(a,b);
        RCB = null;
        clearTimeout(tid);
      }
    }

    worker.send({
      type      : msg_type.CORE_MSG,
      fn        : fn_name,
      fnid      : reg_rcb(_rcb),
      parms     : parms
    });
  }


  function test(rc, RCB, __ext) {
    return run(rc, RCB, null, IS_TEST, __ext);
  }


  //
  // 与 core 不同, 返回一个对象, 用于进一步操作
  //
  function run(rc, RCB, _identify, __is_test, _log_ext) {
    if (!_identify) _identify = rc.rid;
    if (cores[ _identify ]) {
      RCB(new Error('任务运行中'));
      return;
    }

    create_worker(_identify);

    call_fn(_identify, 'run', RCB, {
      rc        : rc,
      _identify : _identify,
      __is_test : __is_test,
      __ext     : _log_ext,
    });

    return createCoreRet(_identify);
  }


  function stop(_identify, RCB) {
    call_fn(_identify, 'stop', RCB, {
      rid : _identify
    });
  }


  function getHistory(_identify, being, length, RCB) {
    var hc = his_saver[ _identify ];
    if (hc) {
      RCB(null, hc);
      return;
    }

    call_fn(_identify, 'getHistory', RCB, {
      rid    : _identify,
      being  : being,
      length : length,
    });
  }


  //
  // 这个方法的返回有延迟
  //
  function getCurrentState(_identify, RCB) {
    var hc = his_saver[ _identify ];
    if (hc) {
      setTimeout(function() {
        RCB(null, { 
          uptime : 0, 
          tid    : hc.targetID,
          state  : hc.state });
      }, 1000);
      return;
    }

    // 没有运行时信息不是错误
    if (!cores[_identify]) {
      RCB(null, { tid: corelib.STATE.STOPPED, isstop: true });
      return;
    }

    call_fn(_identify, 'getCurrentState', RCB, {rid : _identify });
  }


  function createCoreRet(_identify) {
    function onStop(fn) {
      event.once('stoped:' + _identify, fn);
    }

    return {
      onStop : onStop,
    };
  }
}


//
// 一个任务进程运行一个内核
// 通过进程间通讯交换数据
// return null;
//
function createWork() {
  var core = corelib.createCore();

  //
  // 处理函数列表, Function(msg)
  //
  var call_proxy = {
    run                 : call_run,
    stop                : call_stop,
    getHistory          : call_getHistory,
    getCurrentState     : call_getCurrentState,
  };

  //
  // 当从老大处接收到函数调用后, 转发到对应的处理函数
  //
  process.on('message', function(msg) {
    if (msg.type != msg_type.CORE_MSG) return;
    call_proxy[ msg.fn ](msg, msg.parms);
  });


  //
  // 创建一个回调函数, 当回调被调用时, 参数被发回老大进行处理
  //
  function create_rcb_proxy(msg) {
    var RCB = function(err, data) {
      process.send({
        type : msg_type.CORE_MSG,
        fnid : msg.fnid,
        err  : err && err.message,
        data : data
      });
    }
    return RCB;
  }


  function call_run(msg, p) {
    core.run(p.rc, create_rcb_proxy(msg), p._identify, p.__is_test, p.__ext);
    wait_stop(p);
  }


  function call_stop(msg, p) {
    core.stop(p.rid, create_rcb_proxy(msg));
  }


  function call_getHistory(msg, p) {
    core.getHistory(p.rid, p.being, p.length, create_rcb_proxy(msg));
  }


  function call_getCurrentState(msg, p) {
    core.getCurrentState(p.rid, create_rcb_proxy(msg));
  }


  function wait_stop(p) {
    var _identify = p._identify || p.rc.rid;
    logger.log('启动进程运行任务', _identify, process.pid);

    core.getHistory(_identify, 0,0, function(err, hc) {
      if (err) {
        logger.error(err);
        return;
      }

      hc.isStop = _stop;

      function _stop(next) {
        //
        // 在结束前发送历史数据给老大, 
        // 之后老大可以发送这些数据到浏览器端
        //
        process.send({
          type : msg_type.CORE_MSG,
          fnid : SEND_HISTORY,
          data : hc,
        });

        logger.log('任务结束进程退出', _identify, process.pid);
        quit_th.exit();
      }
    });
  }
}