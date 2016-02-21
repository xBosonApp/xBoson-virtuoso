var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var __NAME  = 'etl-tran-seq';


module.exports = {
  name          : "增加序列",
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

  // ch.mustStr('name');
  ch.mustStr('field');
  ch.mustNum('begin', 0, Number.MAX_VALUE);
  ch.mustNum('end', cf.begin, Number.MAX_VALUE);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name  : '增加序列',
    field : '',
    begin : 0,
    end   : 1
  };
  RCB(null, conf);
}


function create_filter(conf, recv, send) {
  var head  = recv.getHead();
  var type  = recv.getType();

  var fi = head.length;
  head.push(conf.field);
  type.push('DECIMAL');

  send.setHead(head);
  send.setType(type);

  var b = conf.begin;
  var e = conf.end;
  var c = b;

  return function(data, saver) {
    data[fi] = c;
    if (++c > e) c = b;
    saver(data);
  };
}
