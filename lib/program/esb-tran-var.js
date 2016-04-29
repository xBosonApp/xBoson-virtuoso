var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');

var __NAME  = 'esb-tran-var';


var pg_cnf = module.exports = {
  name          : "变量",
  groupName     : "数据转换",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : 0,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.fix_name, cf.fix_var);
  tool.zip_arr(cf.flow_name, cf.flow_var);

  ch.mustArr('fix_name');
  ch.mustArr('fix_var');
  ch.mustArr('flow_name');
  ch.mustArr('flow_var');

  ch.arrNotNul('fix_name');
  ch.arrNotNul('fix_var');
  ch.arrNotNul('flow_name');
  ch.arrNotNul('flow_var');

  ch.arrNotRepeat('fix_name', 'flow_name');

  if (cf.fix_name.length + cf.flow_name.length < 1) {
    return RCB({ retmessage:'必须设置一个变量' });
  }

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    name : pg_cnf.name,
    fix_name  : [],
    fix_var   : [],
    flow_name : [],
    flow_var  : [],
  };
  RCB(null, cf);
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();

  try {
    for (var i=conf.fix_name.length-1; i>=0; --i) {
      process_var(conf.fix_name[i], conf.fix_var[i], true);
    }
    for (var i=conf.flow_name.length-1; i>=0; --i) {
      process_var(conf.flow_name[i], conf.flow_var[i], false);
    }
  } catch(err) {
    tool.esb_error(err, interactive, data);
    return;
  }

  interactive.runOver(recv);


  function process_var(name, _var, is_fix) {
    var expout = tool.expression_complier(name, true);
    var vin    = null;

    if (is_fix) {
      vin = _var;
    } else {
      var expin2 = tool.expression_complier(_var, true);
      vin = expin2.val(data);
    }

    expout.val(data, vin);
  }
}
