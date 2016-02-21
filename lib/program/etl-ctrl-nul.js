var checker = require('../checker.js');

var __NAME  = 'etl-ctrl-nul';


module.exports = {
  name          : "空操作",
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
    name: '空操作',
    desc: ''
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  interactive.runOver(interactive.getData());
}
