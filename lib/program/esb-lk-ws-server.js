var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var pairpro = require('./esb-lk-ws-server-out.js');
var syscnf  = require('configuration-lib').load();
var urllib  = require('url');
var soap    = require('soap');
var o2w     = require('../obj2wsdl.js');


var __NAME    = 'esb-lk-ws-server';
var TEXT_MODE = 't';
var DEF_CODE  = 'UTF-8';
var localip   = require("my-local-ip")();


var pg_cnf = module.exports = {
  name          : "WebService 服务端",
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
    url      : '/soap',
    port     : syscnf.eeb_zy.http_server_port,

    nservice : '',
    nport    : '',
    nfunc    : '',

    inn      : [],
    inv      : [],
    intt     : [],
    outn     : [],
    outt     : []
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.inn, cf.inv, cf.intt);
  tool.zip_arr(cf.outn, cf.outt);

  ch.mustArr('inn');
  ch.mustArr('inv');

  ch.arrNotRepeat('inn');
  ch.arrNotNul('inv');
  ch.arrNotNul('intt');

  ch.mustArr('outn');
  ch.mustArr('outt');
  ch.arrNotRepeat('outn');
  ch.arrNotNul('outt');

  ch.mustNum('port', 100, 65535);
  ch.mustStr('url', 1, 255);
  ch.mustStr('nservice', 1, 64);
  ch.mustStr('nport', 1, 64);
  ch.mustStr('nfunc', 1, 64);

  RCB(ch.getResult());
}


function run(interactive, limit, is_test) {
  var root    = interactive.getConfig();
  var conf    = root.run_config;
  var stop    = false;
  var checkid = {};

  if (is_test) {
    return create_tester(conf, interactive);
  }

  interactive.onStop(function() {
    stop = true;
  });

  tool.loop_event(interactive, etype.END, when_end);
  tool.loop_event(interactive, etype.SERVEICE_RESPONSE, response);
  // htpool.add_mid(conf.url, null, false, not_call_fn, createWSServer);
  htpool.get_server(conf.url, conf.port, false, null, not_call_fn, createWSServer);

  interactive.sendEvent(etype.STATISTICS, 
      {txt:'服务在 ' + conf.url + ' 上等待 WebService 请求'});
  interactive.sendEvent(etype.STATISTICS_END);


  //
  // 当有请求发起时被回调
  //
  function request(args, retcb, headers) {
    if (stop) {
      return next();
    }

    //
    // 发送到 flow head 中的数据
    //
    var head = { request_id : uuid.v4(), retcb: retcb };
    var data = { wss_in: {}, headers: headers };

    checkid[ head.request_id ] = 1;

    for (var n in args) {
      data.wss_in[n] = args[n];
    }

    var send = interactive.createFlow();
    send.setHead(head);
    send.setType({ wss: { n:conf.outn, t:conf.outt } });
    send.push(data);
    interactive.runOver(send);

    interactive.sendEvent(etype.SERVICE_BEG_LOG, 
        { time: Date.now(), request_id: head.request_id, msg: JSON.stringify(args) });
  }


  function response(rdata) {
    var recv = rdata.data;
    var head = recv.getHead();

    if (!checkid[ head.request_id ]) {
      interactive.sendEvent(etype.ERROR, new Error('应答与请求不在一个闭环中'));
      return;
    }
    delete checkid[ head.request_id ];

    head.retcb(rdata.outp);
    rdata.over(head.request_id);

    interactive.sendEvent(etype.SERVICE_END_LOG,
        { time: Date.now(), request_id: head.request_id });
  }


  function createWSServer(err, closefn, server) {
    if (err) {
      interactive.sendEvent(etype.ERROR, err);
      return;
    }
    interactive.onStop(closefn);

    var p    = null;
    var srv  = {};
    var opt  = {};
    var purl = urllib.parse(conf.url);

    if (!purl.protocol) purl.protocol = 'http';
    if (!purl.hostname) purl.hostname = localip;
    if (!purl.port)     purl.port     = conf.port;

    opt.url = urllib.format(purl);
    opt.services = {};

    p = srv[ conf.nservice ] = {};
    p = p[ conf.nport ] = {};
    p = p[ conf.nfunc ] = request;

    p = opt.services[ conf.nservice ] = {};
    p = p[ conf.nport ] = {};
    p = p[ conf.nfunc ] = { 'in' : {}, 'out' : {} };

    conf.inn.forEach(function(n, i) {
      p['in'][n] = conf.intt[i];
    });

    conf.outn.forEach(function(n, i) {
      p.out[n] = conf.outt[i];
    });

    o2w.build_wsdl(srv, opt, function(err, xml) {
      if (err) {
        interactive.sendEvent(etype.ERROR, err);
        return;
      }

      // interactive.log('wsdl xml is build', xml);
      var soapserver = soap.listen(server, purl.pathname, srv, xml);

      soapserver.log = function(type, data) {
        interactive.log(type, data);
      };
    }); 
  }

  function when_end() {
    /* do nothing */
  }

  function not_call_fn(req, resp, next) {
    interactive.log("永远不应该被调用");
    next();
  }
}


function create_tester(conf, interactive) {
  var data = { wss_in: {}, headers: {} };
  var head = { request_id : uuid.v4(), resp: null };
  var type = { wss: { n:conf.outn, t:conf.outt } };

  conf.inn.forEach(function(n, i) {
    data.wss_in[n] = conf.inv[i];
  });

  var send = interactive.createFlow();
  send.setHead(head);
  send.setType(type);
  send.push(data);
  interactive.runOver(send);
}