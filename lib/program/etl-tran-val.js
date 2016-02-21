var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var event   = require('../type-event.js');


module.exports = {
  name          : "值转换",
  groupName     : '数据转换',
  programID     : "__etl_tran_val__",
  configPage    : 'etl-tran-val.htm',
  className     : 1,
  icon          : 'etl-tran-val.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : tool.create_tran_run(create_trans_val)
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  // ch.mustStr('name');
  ch.mustStr('src_field');
  ch.mustArr('val');
  ch.arrNotRepeat('val');
  ch.mustArr('trans');

  if(cf.val.length != cf.trans.length) {
    ch.push('retmessage', '程序异常:数组长度不同');
  }

  tool.zip_arr(cf.val, cf.trans);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name          : '值转换',
    src_field     : '',
    target_field  : '',
    default_val   : '',
    val           : [],
    trans         : []
  };
  RCB(null, conf);
}


function create_trans_val(conf, recv, send) {
  var map = {};

  if (conf.val.length < 1) {
    return tool.NOCHANGE;
  }

  for (var i = 0; i < conf.val.length; ++i) {
    map[ conf.val[i] ] = conf.trans[i];
  }

  var src_field    = conf.src_field;
  var target_field = conf.target_field;
  var def          = conf.default_val;
  var scol         = recv.getColumn(src_field);
  var tcol         = -1;

  if (target_field) {
    var head = recv.getHead();
    var type = recv.getType();

    for (var i=0; i<head.length; ++i) {
      if (head[i] == target_field) {
        throw new Error("目标列错误, 不能有 " + target_field);
      }
    }

    tcol = head.length;
    head.push(target_field);
    type.push(type[ scol ]); // ?? 要复制源字段类型 ??

    send.setHead(head);
    send.setType(type);

  } else {
    recv.clone(send);
    tcol = scol;
  }

  return function(d, saver) {
    var v = d[scol];
    d[tcol] = map[v] || def || v;
    saver(d);
  };
}
