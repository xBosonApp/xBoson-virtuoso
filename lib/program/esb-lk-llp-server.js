var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var pairpro = require('./esb-lk-llp-server-out.js');
var net     = require('net');


var __NAME  = 'esb-lk-llp-server';
var _SB     = 0x0B;
var _EB     = 0x1C;
var _CR     = 0x0D;

var _SSB    = String.fromCharCode(0x0B);
var _SEB    = String.fromCharCode(0x1C);
var _SCR    = String.fromCharCode(0x0D);

var _TEXT   = 1;
var _BUFFER = 2;


var pg_cnf = module.exports = {
  name          : "LLP 服务端",
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
    port     : 6969,
    timeout  : 15, // s
    otype    : 1,
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);
  ch.mustNum('port', 100, 65535);
  ch.mustNum('timeout', 1, 65535);
  RCB(ch.getResult());
}


function run(interactive, limit, is_test) {
  var root    = interactive.getConfig();
  var conf    = root.run_config;
  var checkid = {};
  var txt_mod = parseInt(conf.otype) == _TEXT;

  if (is_test) {
    return create_tester(conf, interactive);
  }

  var service_ctx = tool.create_esb_service_context(interactive, response);
  var sserver = net.createServer(request);
  sserver.listen(conf.port);

  service_ctx.start('服务在端口 ' + conf.port + ' 上等待 LLP 请求');

  interactive.onStop(function() {
    sserver.close();
  });


  //
  // 当有请求发起时被回调
  //
  function request(sock) {
    if (service_ctx.stop) return sock.end();
    sock.setTimeout(parseInt(conf.timeout) * 1000);


    var bufs = [];
    var isbegin = true;
    var isEnd = false;


    sock.on('data', function (buf) {
      if (isbegin) {
        if (buf[0] !== _SB) {
          return sock.destroy();
        }
        isbegin = false;
        buf = buf.slice(1);
      }

      if (  buf[ buf.length-2 ] == _EB 
         && buf[ buf.length-1 ] == _CR) {
        isEnd = true;
        buf = buf.slice(0, buf.length-2);
      }

      bufs.push(buf);

      if (isEnd) {
        _over();
      }
    });

    sock.on('error', function(err) {
      interactive.log('发生错误', err);
    });

    sock.on('timeout', function(err) {
      interactive.log('超时');
      sock.end();
    });

    function _over() {
      var head = { sock: sock };
      var data = { llp_data: Buffer.concat(bufs) };
      
      service_ctx.request(head, '接收缓冲区 ' + data.llp_data.length + ' 字节');

      if (txt_mod) {
        data.llp_data = data.llp_data.toString();
      }

      var send = interactive.createFlow();
      send.setHead(head);
      send.push(data);
      interactive.runOver(send);
    }
  }


  function response(recv, ret_field, _over) {
    var head = recv.getHead();
    var sock = head.sock;
    sock.write(_SSB);
    sock.write(ret_field);
    sock.write(_SEB);
    sock.write(_SCR);
    sock.end();
    _over();
  }
}


var hl7msg = [
 "MSH|^~\\&|NES|NINTENDO|TESTSYSTEM|TESTFACILITY|20010101000000||ADT^A04|Q123456789T123456789X123456|P|2.3"
,"EVN|A04|20010101000000|||^KOOPA^BOWSER"
,"PID|1||123456789|0123456789^AA^^JP|BROS^MARIO||19850101000000|M|||123 FAKE STREET^MARIO \T\ LUIGI BROS PLACE^TOADSTOOL KINGDOM^NES^A1B2C3^JP^HOME^^1234|1234|(555)555-0123^HOME^JP:1234567|||S|MSH|12345678|||||||0|||||N"
,"NK1|1|PEACH^PRINCESS|SO|ANOTHER CASTLE^^TOADSTOOL KINGDOM^NES^^JP|(123)555-1234|(123)555-2345|NOK"
,"NK1|2|TOADSTOOL^PRINCESS|SO|YET ANOTHER CASTLE^^TOADSTOOL KINGDOM^NES^^JP|(123)555-3456|(123)555-4567|EMC"
,"PV1|1|O|ABCD^EFGH||||123456^DINO^YOSHI^^^^^^MSRM^CURRENT^^^NEIGHBOURHOOD DR NBR|^DOG^DUCKHUNT^^^^^^^CURRENT||CRD|||||||123456^DINO^YOSHI^^^^^^MSRM^CURRENT^^^NEIGHBOURHOOD DR NBR|AO|0123456789|1|||||||||||||||||||MSH||A|||20010101000000"
,"IN1|1|PAR^PARENT||||LUIGI"
,"IN1|2|FRI^FRIEND||||PRINCESS" ];


function create_tester(conf, interactive) {
  var data = { llp_data  : hl7msg.slice(0, 3).join("\r") };
  var head = { request_id : uuid.v4(), sock: null };

  if (parseInt(conf.otype) == _BUFFER) {
    data.llp_data = new Buffer(data.llp_data);
  }

  var send = interactive.createFlow();
  send.setHead(head);
  send.push(data);
  interactive.runOver(send);
}
