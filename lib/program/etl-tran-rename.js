var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var __NAME  = 'etl-tran-rename';


module.exports = {
  name          : "字段改名",
  groupName     : "数据转换",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : tool.create_tran_run(create_filter)
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.sn, cf.tn);

  ch.mustArr('sn');
  ch.arrNotRepeat('sn');

  ch.mustArr('tn');
  ch.arrNotRepeat('tn');
  ch.arrNotNul('tn');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name  : '字段改名',
    sn    : [],
    tn    : []
  };
  RCB(null, conf);
}


function create_filter(conf, recv, send) {
  var head  = recv.getHead();
  var type  = recv.getType();

  if (conf.sn.length < 1) {
    return tool.NOCHANGE;
  }

  conf.sn.forEach(function(sn, i) {
    var c = recv.getColumn(sn);
    head[c] = conf.tn[i];
  });

  send.setHead(head);
  send.setType(type);
  
  return function(d, saver) {
    saver(d);
  }
}