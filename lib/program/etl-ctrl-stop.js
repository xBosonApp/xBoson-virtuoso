var event   = require('../type-event.js');

var __NAME  = 'etl-ctrl-stop';


module.exports = {
  name          : "中止",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 3,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 0,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function checkConfig(configJSON, RCB) {
  RCB();
}


function createConfig(RCB) {
  var conf = {
    name: '中止',
    desc: ''
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  interactive.sendEvent(event.STOP);
}
