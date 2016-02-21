var pairpro = require('./esb_jms_in_end.js');
var etype   = require('../type-event.js');
var tool    = require('../program-tool.js');
var checker = require('../checker.js');
var jms     = require('jms-lib');
var http    = require('http');
var uuid    = require('uuid-zy-lib');


var __NAME    = 'esb-jms-in';


var pg_cnf = module.exports = {
  name          : "JMS 输入",
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
    name      : pg_cnf.name,
    host      : '',
    port      : '',
    driver    : 'ActiveMQ',
    user      : '',
    pass      : '',
    outvar    : 'jms_out',
    qname     : '',
    selector  : '',
    mode      : 'q',
    shared    : 'y',
    durable   : 'n',
    lsn_name  : '',
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);
  ch.mustStr('host', 1);
  ch.mustStr('driver', 1);
  ch.mustNum('port', 10, 65535);
  ch.mustStr('outvar', 1);
  ch.mustStr('qname', 1);
  RCB(ch.getResult());
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


  try {

    var conn = jms.open(conf);
    var sess = conn.createSession();
    var cons = sess.createConsumer(conf.qname, {
      name            : conf.lsn_name,
      messageSelector : conf.selector,
      shared          : conf.mode === 's' && conf.shared  === 'y',
      durable         : conf.mode === 's' && conf.durable === 'y',
    });

    if (is_test) {
      conn.close();
      var data = { type : 'Text', 
                    msg : 'JMS server connect success. ' 
                        + conn.name + ' <' + conn.version + '>' };

      var send = interactive.createFlow();
      send.setHead({});
      _send(send, data);
      interactive.runOver(send);
    return;
    }

    cons.onData(data_listener);
    conn.start();

    tool.loop_event(interactive, etype.SERVEICE_RESPONSE, response);
    tool.loop_event(interactive, etype.END, do_nothing);

    interactive.sendEvent(etype.STATISTICS, 
        {txt: '服务在 ' + conf.host + ' 上等待 JMS 消息 [' + conf.driver + ']'}); 
    interactive.sendEvent(etype.STATISTICS_END);

    interactive.onStop(function() {
      stop = true;
      conn.stop();
      conn.close();
    });

  } catch(err) {
    var msg = tool.filter_jms_error(err);
    throw new Error(msg);
  }


  function _send(send, data) {
    if (conf.outvar) {
      var pack = {};
      var expin2 = tool.expression_complier(conf.outvar, true);
      expin2.val(pack, data);
      send.push(pack);
    } else {
      send.push(data);
    }
  }


  function data_listener(type, msg) {
    var head = { request_id : uuid.v4() };
    var data = { type : type, msg : msg };
    var send = interactive.createFlow();
    send.setHead(head);
    _send(send, data);
    checkid[ head.request_id ] = 1;
    interactive.runOver(send);
  }


  function response(rdata) {
    var recv = rdata.data;
    var head = recv.getHead();

    if (!checkid[ head.request_id ]) {
      interactive.sendEvent(etype.ERROR, new Error('应答与请求不在一个闭环中'));
      return;
    }
    delete checkid[ head.request_id ];
    rdata.over();

    interactive.sendEvent(etype.SERVICE_END_LOG,
        { time: Date.now(), request_id: head.request_id });
  }


  function do_nothing() {
  }
}