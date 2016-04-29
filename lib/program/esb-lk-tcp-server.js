var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var pairpro = require('./esb-lk-tcp-server-out.js');
var net     = require('net');


var __NAME  = 'esb-lk-tcp-server';


var pg_cnf = module.exports = {
  name          : "TCP 服务端",
  groupName     : "服务",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : 0,
  parent_max    : 0,
  child_max     : 1,

  group_program : [ pairpro.programID ],

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function createConfig(RCB) {
  var cf = {
    name     : pg_cnf.name,
    port     : '',
    timeout  : 15, // s
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);
  ch.mustNum('port', 100, 65535);
  ch.mustNum('timeout', 0, 65535);
  RCB(ch.getResult());
}


function run(interactive, limit, is_test) {
  var root    = interactive.getConfig();
  var conf    = root.run_config;
  var checkid = {};

  if (is_test) {
    return create_tester(conf, interactive);
  }

  var service_ctx = tool.create_esb_service_context(interactive, response);
  var sserver = net.createServer(request);
  sserver.listen(conf.port);

  service_ctx.start('服务在端口 ' + conf.port + ' 上等待 TCP 请求');

  interactive.onStop(function() {
    sserver.close();
  });


  //
  // 当有请求发起时被回调
  //
  function request(sock) {
    if (service_ctx.stop) return sock.end();
    var timeout = parseInt(conf.timeout) * 1000;

    sock.on('error', function(err) {
      interactive.sendError(err);
    });

    if (timeout) {
      sock.setTimeout(timeout);

      sock.on('timeout', function(err) {
        setImmediate(function() {
          interactive.log('超时');
          sock.end();
        });
      });
    }

    var head = { sock: sock };
    var data = { socket: sock };

    service_ctx.request(head, '接收 TCP 客户端: ' +
                        sock.remoteAddress + ':' + sock.remotePort);

    var send = interactive.createFlow();
    send.setHead(head);
    send.push(data);
    interactive.runOver(send);
  }


  function response(recv, _ret_field_null, _over) {
     recv.getHead().sock.end();
    _over();
  }
}


function create_tester(conf, interactive) {
  var data = { message: '无法进行测试, 保存后运行来测试效果' };
  var head = { request_id : uuid.v4(), sock: null };

  var send = interactive.createFlow();
  send.setHead(head);
  send.push(data);
  interactive.runOver(send);
}
