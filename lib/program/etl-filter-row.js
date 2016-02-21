var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var __NAME  = 'etl-filter-row';


module.exports = {
  name          : "过滤记录",
  groupName     : "数据过滤",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : tool.create_tran_run(createFilter)
}


//
// 运算器, 符合条件调用 next 并返回 true, 否则立即返回
// 每个函数返回一个运算器实例
//
var _operator = {
  // >
  1: function(a, b, next) {
    if (a > Number(b)) {
      next();
      return true;
    }
  },
  // <
  2: function(a, b, next) {
    if (a < Number(b)) {
      next();
      return true;
    }
  },
  // >=
  3: function(a, b, next) {
    if (a >= Number(b)) {
      next();
      return true;
    }
  },
  // <=
  4: function(a, b, next) {
    if (a <= Number(b)) {
      next();
      return true;
    }
  },
  // ==
  5: function(a, b, next) {
    if (a == b) {
      next();
      return true;
    }
  },
  // like
  6: function(a, b, next) {
    var exp = RegExp('.*' + b + '.*', 'm');
    if (exp.test(a)) {
      next();
      return true;
    }
  },
  // between
  7: function(a, b, next) {
    var bw = b.split(',');
    if (bw[0] <= a && a <= bw[1]) {
      next();
      return true;
    }
  },
  // is null
  8: function(a, b, next) {
    if (a == null && a !== 0) {
      next();
      return true;
    }
  },
  // is not null
  9: function(a, b, next) {
    if (a != null || a === 0) {
      next();
      return true;
    }
  }
};


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  if (  cf.field.length != cf.cfield.length 
     || cf.field.length != cf.f_val.length
     || cf.field.length != cf.comp.length ) 
  {
    console.log(cf);
    return RCB({retmessage: '配置中 field 长度错误'});
  }

  tool.zip_arr(cf.field, cf.f_val, cf.cfield, cf.comp);

  // ch.mustStr('name');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name   : '过滤记录',
    field  : [],
    cfield : [],
    f_val  : [],
    comp   : [],

    bizlog : {
      filter : {
        desc   : '当数据删除时, 写错误日志',
        msg    : '数据被过滤',
        enable : false,
      }
    }
  };
  RCB(null, conf);
}


function createFilter(conf, recv, send, interactive) {

  if (conf.field.length < 1) {
    interactive.runOver(recv);
    return tool.NOCHANGE;
  }

  recv.clone(send);
  var cl = tool.call_link();

  conf.field.forEach(function(fname, i) {
    var op = _operator[ conf.comp[i] ];
    var b  = conf.f_val[i];

    if (b) {
      var ai = recv.getColumn(fname);

      cl.add(function(rowdata, next) {
        if (!op(rowdata[ai], b, next) ) {
          interactive.bizlog('filter', rowdata);
        }
      });
    } else {
      var ai = recv.getColumn(fname);
      var bi = recv.getColumn(conf.cfield[i]);

      cl.add(function(rowdata, next) {
        if (!op(rowdata[ai], rowdata[bi], next) ) {
          interactive.bizlog('filter', rowdata);
        }
      });
    }
  });

  return cl;
}
