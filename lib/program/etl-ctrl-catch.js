var event   = require('../type-event.js');
var checker = require('../checker.js');

var __NAME  = 'etl-ctrl-catch';
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
  className     : 3,
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

  ch.mustNum('do_next', 1, 3);
  ch.mustNum('do_next_data', 1, 3);
  ch.mustNum('do_recove', 1, 3);
  ch.mustNum('do_recove_data', 1, 3);
  ch.mustNum('rollback', 1, 3);
  ch.mustNum('sendlog', 1, 3);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name            : '捕获异常',
    do_next         : NO,
    do_next_data    : CURR,
    do_recove       : YES,
    do_recove_data  : NO,
    rollback        : NO,
    sendlog         : NO,
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var data = interactive.getData();

  if (conf.sendlog == YES) {
    interactive.log('捕获异常', data.getData());
  }
  do_next();


  function do_next() {
    if (conf.do_next == NO) {
      return rollback();
    }

    var do_next_data;

    if (conf.do_next_data == CURR) {
      do_next_data = interactive.createFlow();
      data.clone(do_next_data);
      do_next_data.push(data.getData());
    } else {
      do_next_data = data;
    }

    interactive.regEvent(event.END, rollback);
    interactive.runOver(do_next_data);
  }


  function rollback() {
    if (conf.rollback == NO) {
      return do_recove();
    }

    interactive.sendEvent(etype.UPDATE_FAIL, do_recove);
  }


  function do_recove() {
    if (conf.do_recove == YES) {
      if (conf.do_recove_data == JUMP) {
        data.next();
      }
      interactive.sendEvent(event.RECOVER_ERROR);
    } else {
      interactive.sendEvent(event.END);
    }
  }
}
