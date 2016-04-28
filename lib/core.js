var logger      = require('logger-lib')('eeb');
var uuid        = require('uuid-zy-lib');
var sysconf     = require('configuration-lib').load();
var Event       = require('events').EventEmitter;
var flow        = require('./flow-data.js');
var ev          = require('./type-event.js');
var instancelib = require('./instanceid.js');
var TMAP        = require('./type-eeb.js');
var progfact    = require('./program-factory.js');
var log_sys     = require('./log-sys.js');
var exit        = require('./exit.js');

//
// 测试运行时的数据限制
//
var LIMIT         = 10;
var STATE_WAIT    = 5 * 1000;
var IS_TEST       = true;
var HISTORY_LIMIT = 80;

//
// 运行状态枚举, 运行中的状态都要大于 1
//
var STATE = {
  TIMEOUT  : -3,
  STOPPED  : -1,
  INIT     : 1,
  RUNNING  : 2,
  STOPPING : 3,
  ERROR    : 4,
};

var STA_NAME = {
  '-3' : '超时',
  '-2' : '有错误',
  '-1' : '已停止',
  '1'  : '初始化',
  '2'  : '运行中',
  '3'  : '停止中',
};


module.exports = {
  createCore    : createCore,
  STATE         : STATE,
  STA_NAME      : STA_NAME,
  LIMIT         : LIMIT,
  STATE_WAIT    : STATE_WAIT,
  IS_TEST       : IS_TEST,
  HISTORY_LIMIT : HISTORY_LIMIT,
};


//
// mid 层保证数据有效性
//
function createCore() {

  var core = {
    checkRunnerConfig   : _checkRunnerConfig,
    test_target         : test_target,
    test                : test,
    run                 : run,
    getHistory          : getHistory,
    getCurrentState     : getCurrentState,
    stop                : stop
  };

  var running_rc = {};


  //
  // 立即返回历史记录
  //
  function getHistory(_identify, being, length, RCB) {
    var historyContent = running_rc[_identify];
    if (!historyContent) {
      return RCB(new Error("未运行"));
    }

    return RCB(null, historyContent);
  }


  //
  // 当历史更新时会立即返回, 或者达到 STATE_WAIT 时间
  //
  function getCurrentState(_identify, RCB) {
    var historyContent = running_rc[_identify];
    if (!historyContent) {
      return RCB(null, { tid: -1, isstop: true });
    }

    historyContent.onChange(back_msg);
    var timeid = setTimeout(back_msg, STATE_WAIT);
    var call = true;

    function back_msg(uptime) {
      clearTimeout(timeid);
      call && RCB(null, {
        uptime : uptime,
        tid    : historyContent.targetID,
        state  : historyContent.state
      });
      call = false;
    }
  }


  function stop(_identify, RCB) {
    var historyContent = running_rc[_identify];
    if (!historyContent) {
      return RCB(new Error("运行历史不存在"));
    }
    historyContent.stop();
    RCB(null, "成功");
  }


  //
  // 仅用于测试运行一个独立的目标
  //
  function test_target(className, targetConfig, _flow_data, RCB) {
    var historyList = [];
    var statistics  = [];

    var testtime = { // 与 [c256] 结构相同
      getCurrentTargetConfig : function() { return targetConfig; },
      getCurrentTargetChild  : function() { return []; },
      history                : function(hc) { historyList.push(hc) },
      runtimeid              : function() { return 1; },
      getCurrentTargetDep    : function() { return {child:[], parent:[]}; },
      onStop                 : function() { return this.onStop },
      // 因为 getCurrentTargetChild 总是返回空所以不会被调用
      nextTarget             : function() {},
      invokeTarget           : invokeTarget,
      className              : className,
    };

    var main_event_link = new Event();
    main_event_link.sendEvent = main_event_link.emit;
    var inter = createInteractive(testtime, _flow_data, main_event_link);

    main_event_link.once(ev.ERROR, function(err) {
      historyList.push(err.message || err || '错误');
      RCB(historyList);
    });

    main_event_link.once(ev.END, function(fdata) {
      RCB(null, fdata.toString(historyList));
    });

    main_event_link.once(ev.STOP, function(err) {
      historyList.push('中止操作');
      RCB(historyList);
    });

    main_event_link.on(ev.STATISTICS, function(msg) {
      var txt = msg.txt || msg;
      if (statistics) {
        statistics.push(txt);
      } else {
        logger.log('statistics 已经关闭: ', txt);
      }
    });

    main_event_link.on(ev.UPDATE_FAIL, function(go_on_next) {
      // 如果收到更新失败事件, 则什么都不做
      go_on_next();
    });

    function invokeTarget(interactive, err) {
      RCB(null, interactive.getData().toString(historyList));
    }


    progfact.getProgram(targetConfig.programID, function(err, prog) {
      if (err) return RCB(err);

      prog.checkConfig(targetConfig.run_config, function(err) {
        if (err) return RCB(err);
        try {
          prog.run(inter, LIMIT, IS_TEST);
        } catch(err) {
          logger.error('Test Target', err);
          RCB(err);
        }
      });
    });
  }


  function getHistoryContent(_identify, _create_it) {
    var hc = running_rc[_identify];
    if (hc == null && _create_it == true) {
      //
      // 这里创建 HistoryContent 的数据结构
      // 这是运行时与外部交换数据的中介
      //
      hc = running_rc[_identify] = {
        runnerId : _identify,
        targetID : null,
        state    : 0,
        begin    : 0,
        content  : [],          // historyList
        stop     : _stop,       // 触发终止事件, 外部调用可以停止运行时
        doStop   : null,        // 这是一个函数空位, 由运行时注入, 调用一次后删除
        isStop   : null,        // 非内核注册, 可以在外部注入, 当全部运行结束调用
        change   : _change,     // 当历史记录内容或状态被改变时调用这个方法
        onChange : _onchange,   // 注册修改监听器, 调用一次后删除
        uptime   : Date.now()   // 状态最后修改日期
      };

      var change_listener = [];

      function _stop() {
        if (hc.state > 0) {
          __call_first('doStop');
        }
      }

      function _change(_state) {
        if (_state) hc.state = _state;
        hc.uptime = Date.now();

        while (change_listener.length > 0) {
          (function() {
            var _fn = change_listener.pop();
            setImmediate(function() {
              _fn(hc.uptime);
            });
          })();
        }
      }

      function _onchange(_handle) {
        if (typeof _handle == 'function') {
          change_listener.push(_handle);
        }
      }

      function __call_first(fnname) {
        if (typeof hc[fnname] == 'function') {
          hc[fnname]();
          hc[fnname] = null;
        }
      }
    }

    // 不保留历史记录
    hc.content = [];

    return hc;
  }


  //
  // 能运行则立即返回, 运行时状态和错误需要调用 getHistory 取得
  // 如果设置了 _identify 则允许 同一个 rc 在多个内核上运行
  //
  // rc        -- 运行时配置
  // _identify -- 识别一个任务的 id, 默认使用 rc.rid
  // __is_test -- 测试运行为 true
  // _log_ext  -- 日志扩展数据, [mid.js:mid386]
  //
  function run(rc, RCB, _identify, __is_test, _log_ext) {
    if (!_identify) _identify = rc.rid;
    if (running_rc[_identify] && running_rc[_identify].state > 0) {
      return RCB(new Error("任务运行中.."));
    }

    var programs;
    var currentTargetID;
    var stop_his_state       = update_history_work();
    var firstTarget          = [];
    var runstate             = getHistoryContent(_identify, true);
    var historyList          = runstate.content;
    var runtimeid            = uuid.v4();
    var runner_count         = 0;
    var statistics           = [];
    var tbegin               = Date.now();
    var instanceid           = null;
    var log                  = null;
    var release_work         = exit.wait();
    var __limit              = __is_test ? LIMIT : null;
    var main_event_link      = new Event();

    var runtime = { // c256
      runtimeid              : _getRuntimeID,
      getCurrentTargetConfig : _getCurrentTargetConfig,
      getCurrentTargetDep    : _getCurrentTargetDep,
      history                : _history,
      nextTarget             : _nextTarget,
      invokeTarget           : _invokeTarget,
      onStop                 : _onStop,
      className              : rc.className,
    };

    runstate.targetID = null;
    runstate.doStop = _doStop;
    runstate.change(STATE.INIT);
    main_event_link.sendEvent = main_event_link.emit;
    __is_test || wash_child(rc);


    instancelib.get(function(err, _id) {
      instanceid = _id.NODE; //_id[ TMAP[rc.className] ];
      __init_core();
      stop_his_state.begin();
    });


    function __init_core() {
      log = log_sys.create({
        rc          : rc,
        tbegin      : tbegin,
        runtimeid   : runtimeid,
        instanceid  : instanceid,
        __ext       : _log_ext,
      });

      // 取得起始节点, 当 parent 为 0 作为起始节点
      for (var tid in rc.dependent) {
        if (rc.dependent[tid].parent.length == 0) {
          // if (firstTarget) {
          //   return RCB(new Error("不能有多个启动节点"));
          // }
          firstTarget.push(tid);
        }
      }

      if (firstTarget.length == 0) {
        return RCB(new Error("没有启动节点"));
      }

      // 缓存所有目标的程序, 程序更新需要重启任务才生效
      _getAllPrograms(rc, function(err, progs) {
        if (err) {
          runstate.change(STATE.ERROR);
          return RCB(err);
        }

        programs = progs;
        _history("任务启动");
        firstTarget.forEach(_begin);
        // _begin();
        RCB(null, "任务启动");
      });
    }

    //
    // 在内存中记录临时历史记录 (HISTORY_LIMIT 条, 用于配置时的调试
    //
    function save_history(his) {
      if (runstate.content.length > HISTORY_LIMIT) {
        // 保留最开始的部分历史
        runstate.content.length = 10;
      }
      runstate.content.push(his);
    }

    function _getRuntimeID() {
      return runtimeid;
    }

    //
    // 返回一个空参数的方法, 用于释放监听器
    //
    function _onStop(handle) {
      function __warp() {
        try {
          handle();
        } catch(err) {
          _history('中止时 ' + err.message);
          logger.error(err);
        }
      }
      main_event_link.once(ev.STOP_HANDLE, __warp);
      return function() {
        main_event_link.removeListener(ev.STOP_HANDLE, __warp);
      };
    }

    //
    // 让所有的程序都停止, 调用它们的终止函数
    // _is_stop_event -- true 系统事件, false 用户发出
    //
    function _doStop(_is_stop_event) {
      if (runstate.state == STATE.STOPPING)
        return;

      runstate.change(STATE.STOPPING);
      main_event_link.emit(ev.STOP_HANDLE);
      runstate.change(STATE.STOPPED);

      if (!_is_stop_event) {
        _history('用户停止任务');
        statistics && statistics.push('用户终止任务');
      } else {
        _history('所有目标中止, 任务结束');
      }

      _end();
    }

    // Interactive 保证 targetID 的有效性
    function _nextTarget(targetID) {
      runstate.targetID = currentTargetID = targetID;
    }

    //
    // _begin 完成后调用这个方法, 也是后续程序的执行函数
    //
    function _invokeTarget(next_interactive, err) {
      // 如果抛出异常或停止, 则终止异步运行中的任务
      if (runstate.state <= 0) {
        return;
      }

      var conf = _getCurrentTargetConfig();
      var prog = programs[ conf.programID ];

      try {
        runstate.change(STATE.RUNNING);

        if (err) {
          // _history(_create_his("异常捕获", err.message, conf));
        } else {
          _history(_create_his("目标启动", null, conf));
        }

        prog.run(next_interactive, __limit, __is_test);

      } catch(error) {
        if (!next_interactive.processException(error)) {
          main_event_link.emit(ev.ERROR, error);
        }
      }
    }

    function _getCurrentTargetConfig() {
      return rc.targets[currentTargetID];
    }

    function _getCurrentTargetDep() {
      return rc.dependent[currentTargetID];
    }

    function _create_his(err, data, _conf) {
      var his = {
        time : Date.now(),
        msg  : (err && (err.message || err)) || '',
        data : data,
      };

      if (_conf) {
        his.pid = _conf.programID;
        his.tid = _conf.tid;
        his.tname = _conf.tname;
      }
      return his;
    }

    //
    // 如 his 是字符串, 则是由核心写入的历史消息,
    //
    function _history(his, is_err, _conf) {
      if (typeof his == 'string') {
        his = {
          time : Date.now(),
          msg  : his,
        };
      } else if (!his.pname) {
        if (his.pid) {
          var pro = programs[his.pid];
          if (pro) {
            his.pname = pro.name;
          }
        }
      }

      log.det({ his: his, msg_type: is_err });
      save_history(his);
      stop_his_state.add();
    }

    function update_history_work() {
      var history_count = 0;
      var _tid = setInterval(__update, STATE_WAIT);

      function __update() {
        if (history_count > 0) {
          runstate.change();
          history_count = 0;
        }
      }

      function add() {
        ++history_count;
      }

      function begin() {
        _tid = setInterval(__update, STATE_WAIT);
      }

      var ret = function() {
        __update();
        clearInterval(_tid);
      };
      ret.add = add;
      ret.begin = begin;
      return ret;
    }

    function _write_statistics() {
      if (statistics) {
        // 写入概览日志
        if (statistics.length > HISTORY_LIMIT) {
          statistics = statistics.slice(statistics.length - HISTORY_LIMIT);
        }
        log.sta({ tend: Date.now(), msg_arr: statistics });
      }
    }

    //
    // 所有程序都停止, 任务即将退出前被调用
    //
    function _end() {
      _write_statistics();
      log.cls();
      release_work();
      stop_his_state();
      runstate.isStop && runstate.isStop();
    }

    //
    // 开始首个任务
    //
    function _begin(_being_target) {
      _nextTarget(_being_target);

      main_event_link.once(ev.ERROR, function(err) {
        runstate.change(STATE.ERROR);
        logger.error(err);
        _history( _create_his("发生错误且未捕获", err.message, _getCurrentTargetConfig()) );
        _doStop(true);
      });

      main_event_link.once(ev.END, function(fdata) {
        if (--runner_count === 0) {
          runstate.change(STATE.STOPPED);
          _history("所有目标达成, 任务结束");
          _end();
        }
      });

      main_event_link.once(ev.STOP, function(err) {
        var msg = (err && (err.message || err)) || '';
        _history('中止事件' + msg);
        _doStop(true);
      });

      main_event_link.once(ev.STATISTICS_END, function() {
        _write_statistics();
        // 关闭 statistics 日志的写入
        statistics = null;
      });

      main_event_link.on(ev.STATISTICS, function(msg) {
        var txt = msg.txt || msg;
        if (statistics) {
          statistics.push(txt);
        } else {
          logger.log('statistics 已经关闭: ', txt);
        }
      });

      main_event_link.on(ev.UPDATE_FAIL, function(go_on_next) {
        // 如果收到更新失败事件, 则什么都不做
        go_on_next();
      });

      // main_event_link.on(ev.L_EX_ROWCOUNT, function(_dat) {
      //   _dat.time = new Date();
      // });
      // main_event_link.on( ev.SERVICE_BEG_LOG, log.srv_beg);
      // main_event_link.on( ev.SERVICE_END_LOG, log.srv_end);

      var sub_inter_id = ++runner_count;
      var inter = createInteractive(runtime, null, main_event_link, sub_inter_id);
      _invokeTarget(inter);
    }
  }


  function _getAllPrograms(rc, RCB) {
    var pid = [];
    for (var t in rc.targets) {
      pid.push(rc.targets[t].programID);
    }

    var programs = {};
    var i = -1;
    looppid();

    function looppid() {
      if (++i < pid.length) {
        getprog(pid[i], looppid);
      } else {
        RCB(null, programs);
      }
    }

    function getprog(progid, next) {
      if (programs[progid]) return next();

      progfact.getProgram(progid, function(err, prog) {
        if (err) RCB(err);
        programs[progid] = prog;
        next();
      });
    }
  }

  // 包装 run
  function test(rc, RCB, _log_ext) {
    run(rc, RCB, null, IS_TEST, _log_ext);
  }

  //
  // 后期加入的 exception_tid 在运行时不应该在 config.dependent.child 中
  // 清除掉这些 child 中的 exception_tid
  //
  function wash_child(rc) {
    for (var tid in rc.targets) {
      var t = rc.targets[tid];

      if (t.exception_tid) {
        var child = rc.dependent[tid].child;

        for (var i=0; i<child.length; ++i) {
          if (child[i] == t.exception_tid) {
            child.splice(i, 1);
            break;
          }
        }

      }
    }
  }

  return core;
}


//
// runtime_context 必须导出的函数:
//    runtimeid()               -- 取得运行时实例的 id
//    getCurrentTargetConfig()  -- 取得当前目标的配置, 包含 disp_config, run_config
//    getCurrentTargetDep()     -- 取得当前目标节点的依赖项
//    nextTarget(targetID)      -- 引导入下一个 target,
//                              -- 如果没有更多目标可执行, 发出 END 消息
//    invokeTarget(Interactive) -- 用 Interactive 执行当前 Target
//    history(HisContent)       -- 插入历史记录
//    onStop(Function)          -- 注册停止函数
//    className                 -- 类型编码: 1/2/4
//
// _event_link  Event 对象
//    事件链, 不能为空, 同时要绑定 sendEvent 这个函数可以实现为 emit,
//    或向父层事件监听器发送消息
//
// _flowData    上一个 target 传入的数据, 可能为 null
// _sub_id      一个任务有多个起点, 标记起点的 ID
//
function createInteractive(runtime_context, _flowData, parent_event_link, _sub_id) {

  var intiv = {
    runtimeid           : runtime_context.runtimeid(),
    onStop              : onStop,
    getConfig           : getConfig,
    runOver             : runOver,
    sendEvent           : sendEvent,
    sendError           : sendError,
    regEvent            : regEvent,
    retEventPersistent  : retEventPersistent,
    log                 : log,
    bizlog              : bizlog,
    getData             : getData,
    getChildList        : getChildList,
    createFlow          : createFlow,
    processException    : processException,
  };

  var conf      = runtime_context.getCurrentTargetConfig();
  var dep       = runtime_context.getCurrentTargetDep();
  var child     = dep.child;

  //
  // 新注册的事件处理句柄都会压入对应的事件链中, 当事件被触发
  // 最后一个注册器会被触发, 并被删除, 然后结束, 每一次注册必须对应一次触发
  // 一个程序结束, 所有运行时数据都会被删除
  //
  var _event_link = new Event();
  _event_link.sendEvent = sendEvent;

  //
  // 这个函数不能运行错误连接
  //
  function runOver(flowData, nextTargetID) {
    _event_link.emit(ev.TARGET_OVER);

    if (!flowData) {
      return sendError("目标结束运行, 但没有产生数据");
    } else {
      log("目标结束");
    }

    if (child.length <= 0) {
      sendEvent(ev.END, flowData);
      return;
    }

    if (!nextTargetID) {
      if (child.length > 1) {
        return sendError("目标没有指定要运行的下一个目标");
      }
      else { // IF child.length == 1
        nextTargetID = child[0];
      }
    } else {
      var i=0;

      while (i < child.length) {
        if (child[i] == nextTargetID) break;
        ++i;
      }

      if (i >= child.length) {
        return sendError("指定要运行的下一个目标是非法的");
      }
    }

    runtime_context.nextTarget(nextTargetID);
    var newIntiv = createInteractive(runtime_context, flowData, _event_link, _sub_id);
    runtime_context.invokeTarget(newIntiv);
  }

  //
  // 向当前目标的错误异常连接发送错误数据, 如果没有配置则什么也不做
  // 能处理错误则返回 true, 否则返回 false
  // conf.exception_tid 指明错误链接
  //
  function processException(err) {
    if (conf.exception_tid) {
      try {
        // 错误处理器必须能处理这个特殊属性
        if (runtime_context.className == TMAP.ESB) {
          _flowData.getData().exception = err;
        } else {
          _flowData.exception = err;
        }

        runtime_context.nextTarget(conf.exception_tid);
        runtime_context.invokeTarget(
            createInteractive(runtime_context, _flowData, _event_link, _sub_id), err );
        return true;
      } catch(err) {
        // 一旦出错, 回滚当前执行目标, 使报错的消息正确
        runtime_context.nextTarget(conf.tid);
        logger.error(err);
      }
    }
  }

  function sendEvent(eventname, d1, d2) {
    if (eventname == ev.ERROR) {
      if (processException(d1))
        return;
    }
    if (!_event_link.emit(eventname, d1, d2) ) {
      parent_event_link.sendEvent(eventname, d1, d2);
    }
  }

  function regEvent(eventname, eventHandle) {
    _event_link.once(eventname, eventHandle);
  }

  function retEventPersistent(eventname, eventHandle) {
    _event_link.on(eventname, eventHandle);
  }

  //
  // !!1. 会计入日志, 不应该计入日志
  // 2. 发送错误消息到消息链
  // 3. 绑定 data/code 到 errObj 的属性上
  //
  // errObj     - 一个 Error 对象或是一个字符串
  // data       - 传输一些数据用作调试, 可以空
  // code       - 错误代码
  // recover_fn - 注册一个错误恢复函数
  //
  function sendError(errObj, data, code, recover_fn) {
    if (typeof errObj == 'string') {
      errObj = new Error(errObj);
    }
    // 防止循环引用
    if (data !== _flowData && _flowData.getData() !== data)
      errObj.data = data;
    errObj.code = code;

    if (recover_fn) {
      regEvent(ev.RECOVER_ERROR, recover_fn);
    }

    sendEvent(ev.ERROR, errObj);
    // log(errObj.message, data);
  }

  function bizlog(name, data) {
    sendError(name, data, ev.L_EX_BIZLOG);
  }

  // 公共接口, 不可改变
  function log(msg, data) {
    //
    // 这里创建 HisItem 数据结构
    //
    runtime_context.history({
      time      : Date.now(),
      msg       : msg,
      pid       : conf.programID,
      tid       : conf.tid,
      tname     : conf.tname,
      data      : data
    });
  }

  function onStop() {
    var release = runtime_context.onStop.apply(runtime_context, arguments);
    _event_link.once(ev.TARGET_OVER, release);
  }

  function createFlow() {
    return flow.auto_data(null, runtime_context.className);
  }

  function getData() {
    return _flowData;
  }

  function getChildList() {
    return child;
  }

  function getParentList() {
    return dep.parent;
  }

  function getConfig() {
    return conf;
  }

  return intiv;
}


//
// 检查 rc 中的逻辑是否正确
//
function _checkRunnerConfig(rc, RCB) {
  try {
    //
    // 检查重名, 检查没有被依赖的目标
    //
    var name = {};
    for(var tid in rc.targets) {
      var n = rc.targets[tid].tname;
      if (!n) {
        throw "目标没有名称 `" + tid + "`";
      }
      if (name[n]) {
        throw "目标有重复名称 `" + n + "`";
      }
      if (rc.dependent[tid] == null ||
         (rc.dependent[tid].parent.length < 1 &&
          rc.dependent[tid].child.length < 1) )
      {
        throw "目标是孤立的 `" + n + "`";
      }
      name[n] = 1;
    }

    //
    // 检查重复引用, 检查依赖的目标是否存在
    //
    for(var tid in rc.dependent) {
      if (!rc.targets[tid])
        throw "依赖的目标不存在 TID: `" + tid + "`";

      var exists = {};
      rc.dependent[tid].child.forEach(fore);
      rc.dependent[tid].parent.forEach(fore);

      function fore(_tid) {
        if (!rc.targets[_tid])
          throw "依赖的目标不存在 TID: `" + _tid + "`";

        if (exists[_tid])
          throw "目标有重复连接 `" + rc.targets[_tid].tname + "`";

        exists[_tid] = 1;
      }
    }

    //
    // 检查循环引用
    //
    if (check_loop_link(rc)) {
      throw "出现循环引用";
    }

    //
    // 检查目标程序有效性, 并用程序检查程序配置有效性
    //
    var idarr = [], i = -1;
    for(var tid in rc.targets) { idarr.push(tid); }
    loop();

    function loop() {
      if (++i < idarr.length) {
        check_conf(idarr[i], loop);
      } else {
        RCB(null, 'success');
      }
    }

    function check_conf(tid, next) {
      progfact.getProgram(rc.targets[tid].programID, function(err, prog) {
        if (err) return senderr("程序不存在 " + err);

        var run_config = rc.targets[tid].run_config;
        var dep = rc.dependent[tid];

        if (prog.parent_max !== undefined && dep.parent.length > prog.parent_max) {
          if (prog.parent_max === 0)
            return senderr('目标不允许有父节点');
          else
            return senderr('目标的父级节点不允许超过 ' + prog.parent_max);
        }

        var find_exception_tid = 0;
        var extid = rc.targets[tid].exception_tid;
        if (extid) {
          for (var i=dep.child.length-1; i>=0; --i) {
            if (dep.child[i] == extid) {
              find_exception_tid = 1;
              break;
            }
          }
          if (!find_exception_tid) {
            return senderr('异常连接配置无效');
          }
        }

        if (prog.child_max !== undefined && dep.child.length > prog.child_max + find_exception_tid) {
          if (prog.child_max === find_exception_tid)
            return senderr('目标不允许有子节点');
          else
            return senderr('目标的子节点不允许超过 ' + prog.child_max);
        }

        try {
          prog.checkConfig(run_config, function(err1) {
            if (err1) {
              // logger.debug(err1);
              return senderr("目标配置无效");
            }
            next();
          });
        } catch(terr) {
          return senderr("检查配置时出错");
        }
      });

      function senderr(msg) {
        RCB(new Error("`" + rc.targets[tid].tname + "` " + msg));
      }
    }

  } catch(err) {
    RCB(err, null);
  }
}


//
// 检查循环引用, 失败返回 true
//
function check_loop_link(rc) {
  var dep = rc.dependent;

  for (var tid in dep) {
    var road = {};
    road[tid] = 1;

    if (loop(road, tid)) {
      return true;
    }
  }
  return false;

  function loop(tid, nid) {
    var dc = dep[nid].child;
    for (var i = dc.length-1; i>=0; --i) {
      if ( road[ dc[i] ] ) return true;
      road[ dc[i] ] = 1;
      if ( loop(road, dc[i]) ) return true;
      delete road[ dc[i] ];
    }
    return false;
  }
}


function date_str(mm) {
  var d = new Date(mm);
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate() + ' '
       + d.getHours()    + ':' +  d.getMinutes()  + ':' + d.getSeconds();
}
