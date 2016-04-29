var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');

var __NAME  = 'esb-tran-mapping';


var pg_cnf = module.exports = {
  name          : "数据映射",
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
  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    name   : pg_cnf.name,
    target : {},
  };
  RCB(null, cf);
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var rd   = recv.getData();

  var sd    = {}
  var frame = conf.target;

  try {
    _obj(frame, sd);
  } catch(err) {
    tool.esb_error(err, interactive, sd);
    return;
  }

  var send = interactive.createFlow();
  send.push(sd);
  send.setHead(recv.getHead());
  interactive.runOver(send);


  function _obj(f, s) {
    for (var n in f) {
      _val(f, s, n);
    }
  }

  function _arr(f, s) {
    var len = f.length;
    for (var i=0; i<len; ++i) {
      _val(f, s, i);
    }
  }

  function _val(f, s, n) {
    if (f[n] == null) {
      s[n] = null;

    } else if (typeof f[n] == 'object') {

      if (f[n].constructor === Array) {
        s[n] = [];
        _arr(f[n], s[n]);
      } else {
        s[n] = {};
        _obj(f[n], s[n]);
      }

    } else {
      var exp = tool.expression_complier(f[n], true);
      s[n] = exp.val(rd);
    }
  }
}
