var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var net     = require('net');


var __NAME    = 'esb-lk-tcp-client';
var TIMEOUT   = 15;


var pg_cnf = module.exports = {
  name          : "TCP 客户端",
  groupName     : "连接器",
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

  ch.mustNum('port', 10, 65535);
  ch.mustStr('host', 1, 255);
  ch.mustStr('fout', 1, 255);
  ch.mustNum('timeout', 0, 65535);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    name     : pg_cnf.name,
    host     : 'localhost',
    port     : '80',
    fout     : 'tcp_client_socket',
    timeout  : TIMEOUT,

    bizlog : {
      err : {
        desc   : '当处理数据失败时, 写错误日志',
        msg    : '失败',
        enable : false,
      }
    }
  };
  RCB(null, cf);
}


function run(interactive, limit, is_test) {
  var root  = interactive.getConfig();
  var conf  = root.run_config;
  var recv  = interactive.getData();
  var data  = recv.getData();
  var over  = false;


  try {
    var exp = tool.expression_complier(conf.fout, true);

    if (is_test) {
      exp.val(data, '无法进行测试, 保存后运行来测试效果');
      _over();
      return;
    }

    var socket = net.connect(conf.port, conf.host, function() {
      exp.val(data, socket);
      _over();
    });

    var timeout = parseInt(conf.timeout) * 1000;
    if (timeout) {
      socket.setTimeout(timeout);
      socket.on('timeout', function() {
        socket.end();
      });
    }

    socket.on('error', _over);

    interactive.onStop(function() {
      socket.end();
    });

  } catch(err) {
    _over(err);
  }


  function _over(err) {
    if (err) {
      tool.esb_error(err, interactive, data);
    }
    if (!over) {
      interactive.runOver(recv);
      over = true;
    }
  }
}
