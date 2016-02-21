var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var event   = require('../type-event.js');
var cnflib  = require('configuration-lib');

var __NAME  = 'etl-ctrl-copy';


module.exports = {
  name          : "复制",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 99,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function checkConfig(configJSON, RCB) {
  RCB();
}


function createConfig(RCB) {
  var conf = {
    name: '复制',
    desc: ''
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  var data = interactive.getData();
  var ch = interactive.getChildList();
  var i  = 0;

  loop();

  //
  // 如果有多个子目标, 则首先进入一个子目标, 当子目标结束运行
  // 拦截 end 事件, 并进入另一个子目标, 直到所有子目标结束
  // 发送 end 事件到上级目标
  //
  function loop() {

    if (i+1 < ch.length) {
      interactive.regEvent(event.END, function() {
        ++i;
        loop();
      });
    }

    var send = null;

    switch (data.className) {
      case flow.TYPE.ETL:
        send = data;
        send.moveto(0);
        break;

      case flow.TYPE.ESB:
        send = cnflib.extends(data);
        break;

      default:
        throw new Error('unknow data type:' + data.className);
    }


    interactive.runOver(send, ch[i]);
  }
}
