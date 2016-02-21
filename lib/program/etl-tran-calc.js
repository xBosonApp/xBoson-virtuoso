var tool    = require('../program-tool.js');
var checker = require('../checker.js');
var event   = require('../type-event.js');
var flowT   = require('../flow-data.js').TYPE;
var dm      = require('decimal');
var mm      = require('moment');
var crypto  = require('crypto');
var crc     = require('crc');
var adler   = require('adler32');

var __NAME  = 'etl-tran-calc';


module.exports = {
  name          : "计算",
  groupName     : "数据转换",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1+2,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : __run,
};


var _etl_run_fn = tool.create_tran_run(create_op);


function __run(interactive, limit, is_test) {
  var data = interactive.getData();

  switch (data.className) {

    case flowT.ETL:
      _etl_run_fn(interactive, limit, is_test);
      break;

    case flowT.ESB:
      _esb_run_fn(interactive, limit, is_test);
      break;

    default:
      throw new Error('unsupport');
  }
}

//////// --------------------------------------------------- 运算符 Being

var default_date_format = 'YYYY-MM-DD';
var NUL = '';


// 数字运算, 精度
function nfix(a, len) {
  if (len >= 0 && len < 20 && isNaN(a) == false) {
    return a.toFixed(len);
  } else {
    return a;
  }
}

// 字符串, 长度
function slen(a, len) {
  if (len && a) {
    return a.substr(0, len);
  } else {
    return a;
  }
}

// 字符串执行函数
function sdo(a, fn_name) {
  if (a && a[fn_name]) {
    return a[fn_name];
  } else {
    return NUL;
  }
}


var operator = {
  // a - 参数1, b - 参数2, len - 长度 / 精度
  // 如果索引第一个字母是 B 则 B 字段必须指定
  // 视情况采用 len
  // 返回计算结果
  '-Btemplate' : function(a, b, len) {},

//////// -----------------------------------/ 数字运算 /---//

  'Bn+': function(a, b, len) {
    return nfix(dm(a).add(b).toNumber(), len);
  },

  'Bn-': function(a, b, len) {
    return nfix(dm(a).sub(b).toNumber(), len);
  },

  'Bn*': function(a, b, len) {
    return nfix(dm(a).mul(b).toNumber(), len);
  },

  'Bn/': function(a, b, len) {
    return nfix(dm(a).div(b).toNumber(), len);
  },

  'n2': function(a, b, len) {
    return nfix(dm(a).mul(a).toNumber(), len);
  },

  'nS': function(a, b, len) {
    return nfix(Math.sqrt(a), len);
  },

  'BnP': function(a, b, len) { // 100 * (A / B)
    return nfix(dm(100).mul(a).div(b).toNumber(), len);
  },

  'Bn1': function(a, b, len) { // A - (A * B / 100)
    return nfix(dm(a).sub( dm(a).mul(b).div(100) ).toNumber(), len);
  },

  'Bn2': function(a, b, len) { // A + (A * B / 100)
    return nfix(dm(a).add( dm(a).mul(b).div(100) ).toNumber(), len);
  },

  'Bn3': function(a, b, len) { // SQRT(A*A + B*B)
    return nfix(Math.sqrt( dm( dm(a).mul(a) ).add( dm(b).mul(b) ).toNumber() ), len);
  },

  'n4': function(a, b, len) { // ROUND( A )
    return nfix(Math.round(a), len);
  },

  'Bn5': function(a, b, len) { // ROUND(A, B)
    var p = Math.pow(10, b);
    var c = dm(a).mul(p);
    c = Math.round(c.toNumber());
    a = dm(c).div(p).toNumber();
    return nfix(a, len);
  },

  'n7': function(a, b, len) {
    return nfix(Math.ceil(a), len);
  },

  'n8': function(a, b, len) {
    return nfix(Math.floor(a), len);
  },

  'n10': function(a, b, len) {
    return nfix(Math.abs(a), len);
  },

//////// ---------------------------------------/ 位运算 /---//

  'Bi1': function(a, b) {
    return parseInt(a) & parseInt(b);
  },

  'Bi2': function(a, b) {
    return parseInt(a) | parseInt(b);
  },

  'Bi3': function(a, b) {
    return parseInt(a) ^ parseInt(b);
  },

  'Bi4': function(a, b) {
    return parseInt(a) << parseInt(b);
  },

  'Bi5': function(a, b) {
    return parseInt(a) >> parseInt(b);
  },

  'bi6': function(a) {
    return ~parseInt(a);
  },

//////// -------------------------------------/ 逻辑运算 /---//

  'Bl1': function(a, b) {
    return a > b;
  },

  'Bl2': function(a, b) {
    return a < b;
  },

  'Bl3': function(a, b) {
    return a == b;
  },

  'Bl4': function(a, b) {
    return a <= b;
  },

  'Bl5': function(a, b) {
    return a >= b;
  },

  'Bl6': function(a, b) {
    return a != b;
  },

  'bl7': function(a) {
    return !a;
  },

//////// -----------------------------------/ 字符串运算 /---//

  's1': function(a, b, len) {
    a = String(a);
    return slen(a.toUpperCase(), len);
  },

  's2': function(a, b, len) {
    a = String(a);
    return slen(a.toLowerCase(), len);
  },

  's3': function(a, b, len) {
    a = String(a);
    return slen(a.replace(/\r/mg, ''), len);
  },

  's4': function(a, b, len) {
    a = String(a);
    return slen(a.replace(/\n/mg, ''), len);
  },

  's5': function(a, b, len) {
    a = String(a);
    return slen(a.replace(/\n|\r/mg, ''), len);
  },

  's8': function(a, b, len) {
    a = String(a);
    return slen(a.replace(/\t/mg, ''), len);
  },

  's6': function(a, b, len) {
    a = String(a);
    return slen(a.replace(/\D/mg, ''), len);
  },

  's9': function(a, b, len) {
    a = String(a);
    return slen(a.replace(/\d/mg, ''), len);
  },

  's7': function(a, b, len) {
    return a.length;
  },

  'Bs1': function(a, b, len) {
    var r = RegExp(String(b), 'mg');
    return slen(a.replace(r, ''), len);
  },

  'Bs2': function(a, b, len) {
    return slen(String(a || b), len);
  },

  'Bs3': function(a, b, len) {
    return slen(String(a) + b, len);
  },

//////// -----------------------------------/ 日期运算 /---//

  'd1': function(a, b, _format) {
    return mm(a, _format).year() || NUL;
  },

  'd2': function(a, b, _format) {
    return mm(a, _format).month()+1 || NUL;
  },

  'd3': function(a, b, _format) {
    return mm(a, _format).dayOfYear() || NUL;
  },

  'd4': function(a, b, _format) {
    return mm(a, _format).dates() || NUL;
  },

  'd5': function(a, b, _format) {
    return mm(a, _format).day()+1 || NUL;
  },

  'd6': function(a, b, _format) {
    return mm(a, _format).weeks() || NUL;
  },

  'd7': function(a, b, _format) {
    return mm(a, _format).hours() || NUL;
  },

  'd8': function(a, b, _format) {
    return mm(a, _format).minute() || NUL;
  },

  'd9': function(a, b, _format) {
    return mm(a, _format).second() || NUL;
  },

  'Bd1': function(a, b, _format) {
    return mm(a, _format).add(b, 'y').format(_format) || NUL;
  },

  'Bd2': function(a, b, _format) {
    return mm(a, _format).add(b, 'M').format(_format) || NUL;
  },

  'Bd3': function(a, b, _format) {
    return mm(a, _format).add(b, 'd').format(_format) || NUL;
  },

  'Bd4': function(a, b, _format) {
    return mm(a, _format).add(b, 'h').format(_format) || NUL;
  },

  'Bd5': function(a, b, _format) {
    return mm(a, _format).add(b, 's').format(_format) || NUL;
  },

  'Bd6': function(a, b, _format) {
    return mm(a, _format).add(b, 'm').format(_format) || NUL;
  },

  'Bd7': function(a, b, _format) {
    return mm(a, _format).add(b, 'w').format(_format) || NUL;
  },

  'd10': function(a, b, _format) {
    return mm(a).format(_format || default_date_format) || NUL; 
  },

//////// -----------------------------------/ 校验运算 /---//

  'c1': function(a, b, format) {
    return crc.crc32(String(a)).toString(format || 16);
  },

  'c2': function(a, b, format) {
    var h = crypto.createHash('md5');
    h.update(a);
    return h.digest(format || 'hex');
  },

  'c3': function(a, b, format) {
    var h = crypto.createHash('sha1');
    h.update(a);
    return h.digest(format || 'hex');
  },

  'c4': function(a, b, format) {
    if (a) {
      var buf = new Buffer(String(a));
      return adler.sum(buf).toString(format || 16);
    }
    return NUL;
  },

  'c5': function(a, b, format) {
    var h = crypto.createHash('sha256');
    h.update(a);
    return h.digest(format || 'hex');
  },

};

//////// --------------------------------------------------- 运算符 END


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  // ch.mustStr('name');
  ch.mustArr('f1');
  ch.mustArr('f2');
  ch.mustArr('ft');
  ch.mustArr('op');
  ch.mustArr('len');

  var res = ch.getResult();

  if (null == res) {
    tool.zip_arr(cf.f1, cf.f2, cf.ft, cf.op, cf.len);
  }

  for (var i=0; i < cf.f1.length; ++i) {
    var opname = cf.op[i];
    var op = operator[opname];

    if (!op) {
      ch.push('op.' + i, '必须选择运算');
      break;
    }

    if (opname[0] == 'B') {
      if (!cf.f2[i]) {
        ch.push('f2.' + i, '必须指定字段B');
        break;
      }
    } else {
      cf.f2[i] = '';
    }
  }

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name : '计算',
    f1   : [],
    f2   : [],
    ft   : [],
    op   : [],
    len  : []
    // type : [],
    // accu : [] 精度与长度公用一个字段
  };
  RCB(null, conf);
}


function init_send_data(target_field, scol, head, type) {
  var tcol = -1; // 目标列索引

  if (target_field) {

    for (var i=0; i<head.length; ++i) {
      if (head[i] == target_field) {
        throw new Error("目标列错误, 不能有 " + target_field);
      }
    }

    tcol = head.length;
    head.push(target_field);
    type.push(type[ scol ]); // ?? 要复制源字段类型 ??

  } else {
    tcol = scol;
  }

  return tcol;
}


function create_op(conf, recv, send) {
  var cl = tool.call_link();
  var head = recv.getHead();
  var type = recv.getType();
  
  conf.f1.forEach(function(_, i) {
    var f1    = recv.getColumn( conf.f1[i] );
    var f2    = recv.getColumn( conf.f2[i] );
    var ft    = init_send_data( conf.ft[i], f1, head, type);
    var op    = operator[ conf.op[i] ];
    var len   = conf.len[i];

    if (f1 !== undefined && op) {

      cl.add(function(data, next) {
        try {
          data[ft] = op(data[f1], data[f2], len);
        } catch(err) {
          data[ft] = err.message;
          console.log(err);
        }
        next();
      });

    } else {
      console.log("参数无效", i, f1, f2, op)
      throw new Error("参数无效");
    }
  });

  send.setHead(head);
  send.setType(type);

  return cl;
}


function _esb_run_fn(interactive, limit, is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();

  conf.f1.forEach(function(o, i) {
    var op  = operator[ conf.op[i] ];
    var len = conf.len[i];

    var e1  = tool.expression_complier(conf.f1[i], true);
    var e2  = tool.expression_complier(conf.f2[i], true);
    var eo  = conf.ft[i] ? tool.expression_complier(conf.ft[i], true) : e1;

    try {
      var outval = op(e1.val(data), e2.val(data), len);
      eo.val(data, outval);
    } catch(err) {
      tool.esb_error(err, interactive, data);
      console.log(err);
    }
  });

  interactive.runOver(recv);
}