var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');

var __NAME  = 'template';


module.exports = {
  name          : "模板",
  groupName     : "测试-分组",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : true,
  parent_max    : 0,
  child_max     : 0,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  // ch.mustNum('col.0', 9, 99);
  // ch.mustStr('id');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    // id: uuid.v4(),
    // name: 'hello test',
    // col: ['a', 'b', 'c', 'z']
  };
  RCB(null, cf);
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var send = interactive.createFlow();

  send.setHead(['ok', new Date(), conf.id, conf.name]);
  send.push(   [   1,          2,       3,         4]);
  
  var ch = interactive.getChildList();
  var nextch = (ch.length > 0) && (nextch = ch[0]);

  interactive.runOver(send, nextch);

  interactive.onStop(function() {
    // clearTimeout(timeid);
  });
}
