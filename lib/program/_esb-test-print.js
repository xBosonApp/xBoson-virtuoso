var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var logger  = require('logger-lib')('eeb');
var advtool = require('masquerade-html-lib').tool;


var __NAME  = 'esb-test-print';


var pg_cnf = module.exports = {
  name          : "打印到控制台",
  groupName     : "测试-分组",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : true,
  parent_max    : 1,
  child_max     : 1,
  not_display   : true,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function createConfig(RCB) {
  var cf = {
    name  : pg_cnf.name,
    flow  : ''
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);
  RCB(ch.getResult());
}


function run(interactive, limit, is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var stop = false;


  interactive.onStop(function() {
    stop = true;
  });

  _over();
  

  function _over() {
    if (stop) return;
    
    var exp  = advtool.expression_complier(conf.flow, true);
    var recv = interactive.getData();

    var out = exp.val(recv.getData());

    logger.debug(
      "---------------------------->> ESB Data, \n", 
        out,
      "\n--------------------------<<");

    interactive.runOver(recv);
  }
}
