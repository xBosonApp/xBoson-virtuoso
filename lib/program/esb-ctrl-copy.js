var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var copy    = require('./etl-ctrl-copy.js');

var __NAME  = 'esb-ctrl-copy';


var pg_cnf = module.exports = {
  name          : "复制",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : copy.configPage, //__NAME + '.htm',
  className     : 2,
  icon          : copy.icon, //__NAME + '.png',
  disable       : 0,
  parent_max    : 1,
  child_max     : 99,

  checkConfig   : copy.checkConfig,
  createConfig  : copy.createConfig,
  run           : copy.run
};

