var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var sort    = require("../sort.js").sort;
var event   = require('../type-event.js');

var __NAME  = 'etl-tran-sort';


module.exports = {
  name          : "排序",
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
  run           : run
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.sf, cf.isup);

  ch.mustArr('sf');
  ch.arrNotRepeat('sf');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name  : '排序',
    sf    : [],
    isup  : []
  };
  RCB(null, conf);
}


var number_tran = {
  DECIMAL:1, TINY:1, SHORT:1, LONG:1, FLOAT:1,
  DOUBLE:1, LONGLONG:1, INT24:1, YEAR:1
}


// 根据类型返回列的转换函数
function get_var_trans_fn(type) {
  
  if ( number_tran[type] ) {
    return Number;
  }

  return String;
}


function create_sorter(conf, recv) {

  if (conf.sf.length < 1) 
    return null;

  var cl = tool.call_link();
  var type = recv.getType();


  conf.sf.forEach(function(sf, i) {
    var isf  = recv.getColumn(sf);
    var isup = conf.isup[i];
    var big  = 1, sm = -1;
    var tran = get_var_trans_fn(type[isf]);

    if (!isup) {
      big = -1;
      sm  =  1;
    }

    cl.add(function(d, next) {
      // null 值不能比较, 转换为数字
      var a = tran(d.a[isf]) || 0,
          b = tran(d.b[isf]) || 0;

      d.eq = (a > b ? big : ( a == b ? 0 : sm));

      if (d.eq == 0) {
        next();
      }
    });
  });


  return function(a, b) {
    var data = {a:a, b:b, eq:0};
    cl(data);
    return data.eq;
  };
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var runn = { run: true };

  interactive.onStop(function() {
    runn.run = false;
  });


  try {
    var sorter = create_sorter(conf, recv);

    if (!sorter) {
      return returnfn(recv);
    }

    sort(recv, sorter, returnfn, runn);

  } catch(err) {
    interactive.sendEvent(event.ERROR, err);
    log.debug(err);
  }
  

  function returnfn(result) {
    interactive.runOver(result);
  }
}
