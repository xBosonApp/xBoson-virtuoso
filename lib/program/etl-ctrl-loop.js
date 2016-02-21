var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var event   = require('../type-event.js');
var tool    = require('../program-tool.js');

var __NAME  = 'etl-ctrl-loop';


module.exports = {
  name          : "循环",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}

function checkConfig(configJSON, RCB) {
  RCB();
}


function createConfig(RCB) {
  var conf = {
    name: '循环',
    desc: ''
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  var data = interactive.getData();
  var send = flow.mem_data();

  var _do_loop = tool.task_dispatch(loop, true);
  var total = 0, succ = 0, fail = 0, runn = true;

  interactive.onStop(function() {
    runn = false;
  });

  //
  // 如果有多个子目标, 则首先进入一个子目标, 当子目标结束运行
  // 拦截 end 事件, 并进入另一个子目标, 直到所有子目标结束
  // 发送 end 事件到上级目标
  //
  function loop() {    
    send.reset();
    data.clone(send);
    data.next();
    send.push(data.getData());


    if (data.has()) {
      interactive.regEvent(event.END, function() {
        runn && _do_loop();
      });
    }

    interactive.regEvent(event.STATISTICS, function(dat) {
      total += dat.total || 0;
      succ  += dat.succ  || 0;
      fail  += dat.fail  || 0;

      if (!data.has()) {
        var msg = "输出数据总计:" + total + ", 成功:" + succ + ", 失败:" + fail;
        interactive.sendEvent(event.STATISTICS, {txt: msg}); 
      }
    });

    interactive.runOver(send);
  }
}
