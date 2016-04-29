var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var Iconv   = require('iconv').Iconv;


var __NAME  = 'esb-lk-llp-server-out';
var __UNDEF;


var pg_cnf = module.exports = {
  name          : "LLP 应答",
  groupName     : "服务",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : 0,
  parent_max    : 1,
  child_max     : 0,

  not_display   : true,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run,
};


function createConfig(RCB) {
  var cf = {
    name          : pg_cnf.name,
    ret_field     : '',
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);
  ch.mustStr('ret_field', 1, 255);
  RCB(ch.getResult());
}


function run(interactive, limit, is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var exp  = tool.expression_complier(conf.ret_field, true);


  if (is_test) {
    throw new Error('该模块不支持测试');
    return;
  }

  var out_ctx = tool.create_esb_service_out_context(interactive);


  if (!out_ctx.stop) {
    try {
      var data = recv.getData();
      var head = recv.getHead();
      var ret = exp.val(data);
    } catch(err) {
      interactive.sendError(err, data, null, finallyfn);
      return;
    }

    finallyfn();

    function finallyfn() {
      out_ctx.end(ret);
    }
  }
}
