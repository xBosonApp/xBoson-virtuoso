var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var __NAME  = 'etl-tran-colspl';


module.exports = {
  name          : "拆分字段",
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

  tool.zip_arr(cf.an, cf.av);

  ch.mustStr('sf', 1);
  ch.mustStr('sp', 1);

  ch.mustArr('tf');
  ch.arrNotNul('tf');
  ch.arrNotRepeat('tf');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name : '拆分字段',
    sf   : '',
    sp   : '',
    tf   : []
  };
  RCB(null, conf);
}


function create_filter(conf, recv, send) {
  if (conf.tf.length < 1) {
    return tool.NOCHANGE;
  }

  var head   = recv.getHead();
  var type   = recv.getType();
  var sp     = String(conf.sp);
  var sindex = recv.getColumn(conf.sf);
  var tindex = [];

  conf.tf.forEach(function(tf, i) {
    tindex.push(head.length);
    head.push(tf);
    type.push('VARCHAR');
  });

  send.setHead(head);
  send.setType(type);

  return function(data, saver) {
    var sub = String( data[sindex] ).split(sp);
    for (var i=0; i<tindex.length; ++i) {
      data[ tindex[i] ] = sub[i];
    }
    send.push(data);
  }
}

