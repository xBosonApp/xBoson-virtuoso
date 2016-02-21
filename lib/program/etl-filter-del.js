var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var __NAME  = 'etl-filter-del';


module.exports = {
  name          : "删除字段",
  groupName     : "数据过滤",
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


function checkConfig(configJSON, RCB) {
  var ch = checker(configJSON);

  // ch.mustStr('name');
  ch.mustArr('field');
  ch.arrNotRepeat('field');

  var res = ch.getResult();

  if (null == res) {
    tool.zip_arr(configJSON.field);
  }

  // console.log(configJSON);
  RCB(res);
}


function createConfig(RCB) {
  var conf = {
    name   : '删除字段',
    field  : []
  };
  RCB(null, conf);
}


function create_filter(conf, recv, send) {
  var head  = recv.getHead();
  var type  = recv.getType();
  var save  = [];
  var shead = [], stype = [];

  for (var h = 0; h < head.length; ++h) {
    var skip = false;

    for (var i = 0; i < conf.field.length; ++i) {
      if (head[h] == conf.field[i]) {
        skip = true;
        break;
      }
    }

    if (!skip) {
      save.push(h);
      shead.push(head[h]);
      stype.push(type[h]);
    }
  }

  send.setHead(shead);
  send.setType(stype);

  // 如果删除了所有列, 返回 null
  if (shead.length < 1) {
    return null;
  }


  return function(d, saver) {
    var ret = [];
    for (var i = 0; i < save.length; ++i) {
      ret[i] = d[ save[i] ];
    }
    ret.line = d.line;
    saver(ret);
  }
}
