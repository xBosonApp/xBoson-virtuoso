var event   = require('../type-event.js');
var checker = require('../checker.js');

var __NAME  = 'esb-ctrl-catch';
var YES     = 1;
var NO      = 2;
var ALL     = 2;
var CURR    = 1;
var JUMP    = 1;


module.exports = {
  name          : "捕获异常",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 99,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustNum('do_next',     1, 3);
  ch.mustNum('sendlog',     1, 3);
  ch.mustNum('binddata',    1, 3);
  ch.mustStr('dataname',    1, 99);
  ch.mustNum('recover',     1, 3);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name        : '捕获异常',
    do_next     : YES,
    sendlog     : NO,
    binddata    : YES,
    dataname    : 'exception',
    recover     : NO,
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();
  var err  = interactive.exception;

  if (conf.sendlog == YES) {
    interactive.log('捕获异常', err.message);
  }
  do_next();


  function do_next() {
    if (conf.do_next == NO) {
      return do_recover();
    }

    if (conf.binddata == YES) {
      var bind = data[conf.dataname] = {
        message : err.message,
        code    : err.code,
        name    : err.name,
      };
      for (var n in err) {
        bind[n] = err[n];
      }
    }

    interactive.regEvent(event.END, do_recover);
    interactive.runOver(recv);
  }


  function do_recover() {
    if (conf.recover == YES) {
      interactive.sendEvent(event.RECOVER_ERROR);
    } else {
      interactive.sendEvent(event.END);
    }
  }
}
