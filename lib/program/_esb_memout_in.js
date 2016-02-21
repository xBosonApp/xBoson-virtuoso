var pairpro = require('./_esb_memout_out.js');
var etype   = require('../type-event.js');
var http    = require('http');
var uuid    = require('uuid-zy-lib');
var tool    = require('../program-tool.js');
var htpool  = require('../http-pool.js');
var advtool = require('masquerade-html-lib').tool;


var __NAME    = 'esb-memout-in';
var DEF_CODE  = 'UTF-8';


var pg_cnf = module.exports = {
  name          : "ESB 内存溢出1",
  groupName     : "连接器",
  programID     : "__" + __NAME + "__",
  configPage    : 'x-test.htm',
  className     : 2,
  icon          : 'esb-test-print.png',
  disable       : true,
  parent_max    : 0,
  child_max     : 1,

  group_program : [ pairpro.programID ],

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function createConfig(RCB) {
  var cf = {
    name : pg_cnf.name,
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  RCB();
}


//
// 测试:
// 1. 使用 http 建立服务, 没有内存溢出情况
//
function run(interactive, limit, is_test) {
  var root    = interactive.getConfig();
  var conf    = root.run_config;
  var stop    = false;
  var checkid = {};


  tool.loop_event(interactive, etype.SERVEICE_RESPONSE, response);
  tool.loop_event(interactive, etype.END, do_nothing);


  // 6 分钟压力测试, 内存停在 130mb
  // var srv = http.createServer(request);
  // srv.listen(8001);

  // 9 分组压力测试, 内存停在 150mb
  htpool.get_server('/a', 8001, false, null, request, rcb);


  function request(req, resp) {
    // console.log('request');

    var head = { request_id : uuid.v4(), resp: resp };
    var data = { query : req.query, headers : req.headers };
    var send = interactive.createFlow();
    send.setHead(head);
    send.push(data);
    interactive.runOver(send);
  }


  function response(rdata) {
    var recv = rdata.data;
    var head = recv.getHead();
    var r = rdata.ret_field;

    // 6 分钟压力测试, 内存停在 240mb
    // var exp  = advtool.expression_complier('a.b', true);
    // exp.val({a: {b:1}});

    head.resp.end(r);
    rdata.over(head.request_id);
  }


  function do_nothing() {
  }


  function rcb(err, closefn) {
    if (err) {
      interactive.sendEvent(etype.ERROR, err);
      return;
    }
    interactive.onStop(closefn);
  }
}