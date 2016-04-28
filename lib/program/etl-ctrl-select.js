var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var event   = require('../type-event.js');


var __NAME  = 'etl-ctrl-select';


module.exports = {
  name          : "选择",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 99,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


var _operator = module.exports.operator = {
  // >
  1: function(a, b, save, next) {
    if (a > Number(b)) {
      return true;
    }
  },
  // <
  2: function(a, b, next) {
    if (a < Number(b)) {
      return true;
    }
  },
  // >=
  3: function(a, b, next) {
    if (a >= Number(b)) {
      return true;
    }
  },
  // <=
  4: function(a, b, next) {
    if (a <= Number(b)) {
      return true;
    }
  },
  // ==
  5: function(a, b, next) {
    if (a == b) {
      return true;
    }
  },
  // like
  6: function(a, b, next) {
    var exp = RegExp('.*' + b + '.*', 'm');
    if (exp.test(a)) {
      return true;
    }
  },
  // between
  7: function(a, b, next) {
    var bw = b.split(',');
    if (bw[0] <= a && a <= bw[1]) {
      return true;
    }
  },
  // is null
  8: function(a, b, next) {
    if (a == null && a !== 0) {
      return true;
    }
  },
  // is not null
  9: function(a, b, next) {
    if (a != null || a === 0) {
      return true;
    }
  }
};


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.comp, cf.f_val, cf.cfield, cf.next, cf.bizmap);

  ch.mustStr('field');
  ch.mustStr('def_next');

  ch.mustArr('comp');
  ch.mustArr('cfield');
  ch.mustArr('f_val');

  ch.mustArr('next');
  ch.arrNotNul('next');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name     : '选择',
    field    : '',
    def_next : '',
    comp     : [],
    cfield   : [],
    f_val    : [],
    next     : [],

    // 每一个元素对应 bizlog 的 KEY
    bizmap   : [],

    // 以 tid 为 key, 依据条件动态生成配置
    // bizlog 方法总是被调用
    bizlog : null,
  };
  RCB(null, conf);
}


function create_filter(conf, recv, nextpath, interactive) {

  if (conf.next.length < 1) {
    return tool.NOCHANGE;
  }

  var fname = conf.field;
  var ai = recv.getColumn(fname);
  var cl = tool.call_link();


  conf.next.forEach(pushNext);
  defaultNext();


  function defaultNext() {
    var tid  = conf.def_next;
    var send = nextpath[tid];

    //
    // 默认路径可以与条件路径相同, 此时应用条件路径的数据
    //
    if (!send) {
      nextpath[tid] = send = recv.clone();
    }

    cl.add(function(rowdata, next) {
      send.push(rowdata);
      next();
    });
  }


  function pushNext(nextpid, i) {
    var send = recv.clone();
    var tid  = conf.next[i];
    var op   = _operator[ conf.comp[i] ];
    var b    = conf.f_val[i];
    var bid  = conf.bizmap[i];
    var usebizlog;

    if (conf.bizlog && conf.bizlog[bid]) {
      usebizlog = conf.bizlog[bid].enable;
    }

    nextpath[tid] = send;

    //
    // interactive.bizlog 总是被调用, 当条件达成才写出日志
    //
    if (b) {
      cl.add(function(rowdata, next) {
        if ( op(rowdata[ai], b) ) {
          usebizlog && interactive.bizlog(bid, rowdata);
          send.push(rowdata);
        } else {
          next();
        }
      });

    } else {

      var bi = recv.getColumn(conf.cfield[i]);

      cl.add(function(rowdata, next) {
        if ( op(rowdata[ai], rowdata[bi]) ) {
          usebizlog && interactive.bizlog(bid, rowdata);
          send.push(rowdata);
        } else {
          next();
        }
      });
    }
  }

  return cl;
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var runn = true;

  interactive.onStop(function() {
    runn = false;
  });

  var pathdata = {};
  var filter = create_filter(conf, recv, pathdata, interactive);

  if (filter === tool.NOCHANGE) {
    return interactive.runOver(recv);
  }

  var tid_array = [];
  for (var tid in pathdata) {
    tid_array.push(tid);
  }


  var _do_task_fn = tool.task_dispatch(_do_task, true);


  function _do_task() {
    try {
      if (runn && recv.has()) {
        recv.next();
        filter( recv.getData() );
        _do_task_fn();

      } else {
        // console.log(pathdata)
        _send_data();
      }
    } catch(err) {
      interactive.sendError(err, recv, null, _do_task_fn);
      console.debug(err);
    }
  } // [End] _do_task


  function _send_data() {
    var tid = tid_array.pop();

    if (tid_array.length > 0) {
      interactive.regEvent(event.END, function() {
        _send_data();
      });
    }

    interactive.runOver(pathdata[tid], tid);
  }
}
