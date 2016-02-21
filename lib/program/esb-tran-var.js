var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');

var __NAME    = 'esb-tran-var';
var FROM_FLOW = '1';
var MANUAL    = '2';


var pg_cnf = module.exports = {
  name          : "变量",
  groupName     : "数据转换",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : 0,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustNum('fr', 1, 3);
  ch.mustStr('vn', 1, 99);

  if (cf.fr == MANUAL) {
    ch.mustStr('val', 1, 99);
  } else {
    ch.mustStr('val2', 1, 99);
  }

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    name : pg_cnf.name,
    vn   : '',
    fr   : MANUAL,
    val  : '',
    val2 : '',

    bizlog : {
      err : {
        desc   : '当处理数据失败时, 写错误日志',
        msg    : '失败',
        enable : false,
      }
    }
  };
  RCB(null, cf);
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();

  try {
    var expout = tool.expression_complier(conf.vn, true);
    var vin    = null;


    if (conf.fr == FROM_FLOW) {
      var expin2 = tool.expression_complier(conf.val2, true);
      vin = expin2.val(data);
    } else {
      vin = conf.val;
    }

    expout.val(data, vin);
  } catch(err) {
    tool.esb_error(err, interactive, data);
  }

  interactive.runOver(recv);
}
