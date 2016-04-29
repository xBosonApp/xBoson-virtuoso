var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');


var __NAME  = 'esb-lk-udp-server-out';


var pg_cnf = module.exports = {
  name          : "UDP 结束",
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
    name     : pg_cnf.name,
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  RCB(null);
}


function run(interactive, limit, is_test) {
  var root = interactive.getConfig();


  if (is_test) {
    throw new Error('该模块不支持测试');
    return;
  }

  var out_ctx = tool.create_esb_service_out_context(interactive);


  if (!out_ctx.stop) {
    out_ctx.end(null);
  }
}
