var event   = require('../type-event.js');

var __NAME  = 'etl-ctrl-sess-being';


module.exports = {
  name          : "开始事务",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function checkConfig(configJSON, RCB) {
  RCB();
}


function createConfig(RCB) {
  var conf = {
    name: '开始事务',
    desc: ''
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  var data      = interactive.getData();
  var conn_pool = [];
  var end_fn    = [];
  var null_fn   = function() { /* 空函数 */ };


  interactive.regEvent(event.BEGIN_UPDATE, function(conn) {
    if (conn) {
      save(conn);
    } else {
      throw new Error("系统错误, BEGIN_UPDATE 事件必须有连接参数");
    }
  });


  forwarding(event.END,   queue_call(submit, closeAll   ));
  forwarding(event.STOP,  queue_call(rollback, closeAll ));
  forwarding(event.ERROR, rollback                       );
  interactive.onStop(     queue_call(rollback, closeAll ));
  reg_update_fail();

  interactive.runOver(data);


  function reg_update_fail() {
    interactive.regEvent(event.UPDATE_FAIL, function(go_on_next) {
      reg_update_fail();
      rollback(go_on_next);
    });
  }


  function save(conn) {
    conn_pool.push(conn);
    end_fn.push(conn.end);
    // 使关闭连接方法失效, 以便可以回滚
    conn.end = null_fn;
    callfn(conn.beginTran, null_fn);
  }


  //
  // 注册 _event 事件, 事件触发时, 调用 fn, 之后转发这个事件到上层
  // fn 必须接受一个函数参数, 当 fn 处理结束则回调这个函数(必须)
  //
  function forwarding(_event, fn) {
    interactive.regEvent(_event, function(event_data) {
      fn(function() {
        interactive.sendEvent(_event, event_data);
      });
    });
  }

  //
  // 返回一个函数, 在调用 fn1 结束后调用 fn2
  // fn1 = fn2 = function(next) {}
  //
  function queue_call(fn1, fn2) {
    return function(_fn3) {
      fn1(function() {
        fn2(function() {
          _fn3();
        });
      });
    }
  }

  function submit(next) {
    var i = -1;
    loop();

    function loop() {
      if (++i < conn_pool.length) {
        callfn(conn_pool[i].commit, loop);
      } else {
        next();
      }
    }
  }


  function rollback(next) {
    var i = -1;
    loop();

    function loop() {
      if (++i < conn_pool.length) {
        callfn(conn_pool[i].rollback, loop);
      } else {
        next();
      }
    }
  }


  function closeAll(next) {
    var i = -1;
    loop();

    function loop() {
      if (++i < end_fn.length) {
        callfn(end_fn[i], loop);
      } else {
        next();
      }
    }
  }


  //
  // fn -- function(_next) {}
  //
  function callfn(fn, next) {
    try {
      fn(function(err) {
        if (err) {
          interactive.log(err.message);
        }
        next();
      });
    } catch(err) {
      interactive.log(err.message);
      next();
    }
  }
}
