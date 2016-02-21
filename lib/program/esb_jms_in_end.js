var etype   = require('../type-event.js');


var __NAME  = 'esb-jms-in-end';
var DEF_CODE  = 'UTF-8';


var pg_cnf = module.exports = {
  name          : "JMS 输入结束",
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
    name : pg_cnf.name,
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  RCB();
}


function run(interactive, limit, is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();
  var head = recv.getHead();
  
  if (is_test) {
    throw new Error('不支持测试');
  }


  // 频繁的加入闭包而不删除导致溢出, 已经修正内核
  interactive.onStop(function() {
    // stop = true;
  });


  interactive.sendEvent(etype.SERVEICE_RESPONSE, {
    //
    // 这里定义了 SERVEICE_RESPONSE 消息的数据结构
    //
    data : recv,
    over : _over,
  });


  function _over() {
    interactive.runOver(recv);
  }
}