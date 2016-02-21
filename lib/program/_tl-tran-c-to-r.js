var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var __NAME  = 'etl-tran-c-to-r';


module.exports = {
  name          : "列转行",
  groupName     : "数据转换",
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
}

function checkConfig(configJSON, RCB) {
  var ch = checker(configJSON);

  // ch.mustNum('col.0', 9, 99);
  // ch.mustStr('id');

  RCB(ch.getResult());
}

function createConfig(RCB) {
  var conf = {
    // id: uuid.v4(),
    // name: 'hello test',
    // col: ['a', 'b', 'c', 'z']
  };
  RCB(null, conf);
}

function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var data = flow.auto_data(limit);

  data.setHead(['ok', new Date(), conf.id, conf.name]);
  data.push(   [   1,          2,       3,         4]);
  
  var ch = interactive.getChildList();
  var nextch = (ch.length > 0) && (nextch = ch[0]);

  interactive.runOver(data, nextch);

  interactive.onStop(function() {
    // clearTimeout(timeid);
  });
}
