/**
 *  Copyright 2023 Jing Yanming
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var pairpro = require('./esb-lk-udp-server-out.js');
var net     = require('dgram');


var __NAME  = 'esb-lk-udp-server';


var pg_cnf = module.exports = {
  name          : "UDP 服务端",
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
    type     : '4',
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);
  ch.mustNum('port', 100, 65535);
  RCB(ch.getResult());
}


function run(interactive, limit, is_test) {
  var root    = interactive.getConfig();
  var conf    = root.run_config;
  var type    = conf.type == '6' ? 'udp6' : 'udp4';

  if (is_test) {
    return create_tester(conf, interactive);
  }

  var service_ctx = tool.create_esb_service_context(interactive, response);
  var sock = net.createSocket(type);


  sock.on('error', function(err) {
    interactive.sendError(err);
  });

  sock.on('message', request);

  sock.on("listening", function () {
    console.log('lis')
    var address = sock.address();
    service_ctx.start('服务在端口 ' + address.port + ' 上等待 UDP 请求');
  });

  sock.bind({
    port     : conf.port,
    exclusive: true
  });


  interactive.onStop(function() {
    sock.close();
  });


  //
  // 当有请求发起时被回调
  //
  function request(msg, rinfo) {
    if (service_ctx.stop) return sock.close();

    var head = { sock: sock };
    var data = { udp_socket: sock, udp_package: msg, udp_info: rinfo };

    service_ctx.request(head, '接收 UDP 客户端: ' +
                        rinfo.address + ':' + rinfo.port);

    var send = interactive.createFlow();
    send.setHead(head);
    send.push(data);
    interactive.runOver(send);
  }


  function response(recv, _ret_field_null, _over) {
    _over();
  }
}


function create_tester(conf, interactive) {
  var data = { udp_package: '无法进行测试, 保存后运行来测试效果', socket: {} };
  var head = { request_id : uuid.v4(), sock: null };

  var send = interactive.createFlow();
  send.setHead(head);
  send.push(data);
  interactive.runOver(send);
}
