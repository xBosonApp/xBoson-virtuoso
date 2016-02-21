var checker = require('../checker.js');

var __NAME  = 'esb-ctrl-merging';


module.exports = {
  name          : "合并",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 3,
  icon          : __NAME + '.png',
  parent_max    : 99,
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
    name: '合并',
    desc: ''
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  interactive.runOver(interactive.getData());
}
