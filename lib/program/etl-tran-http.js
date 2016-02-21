var uuid    = require('uuid-zy-lib');
var http    = require('http');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var __NAME  = 'etl-tran-http';
var DEF_TIMEOUT = 5;


var prog = module.exports = {
  name          : "HTTP 客户端",
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
  run           : tool.create_tran_run(create_filter)
};


function createConfig(RCB) {
  var conf = {
    name     : prog.name,
    host     : '',
    port     : '80',
    path     : '/',
    method   : 'post',
    timeout  : DEF_TIMEOUT,
    out_enc  : 'UTF-8',
    in_enc   : 'UTF-8',
    cols     : [],

    bizlog : {
      tran : {
        desc   : '当调用 http 请求失败, 写业务日志',
        msg    : 'HTTP 失败',
        enable : false,
      }
    }
  };
  RCB(null, conf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.cols);

  ch.mustArr('cols');
  ch.arrNotRepeat('cols');

  ch.mustStr('host', 1);
  ch.mustNum('port', 10, 65535);
  ch.mustStr('path', 1);
  ch.mustNum('timeout', 1, 999);

  var res = ch.getResult();

  if (res == null && 'check_conn' == cf._type) {
    pre_send(cf);
    send_data(cf, {'http':'test'}, function(err, retdata) {
      if (err) {
        RCB('连接失败, ' + err.message);
      } else {
        RCB('连接成功, 返回 ' + retdata);
      }
    });
    return;
  }

  RCB(res);
}


function create_filter(conf, recv, send, interactive) {
  var head = recv.getHead();
  var type = recv.getType();

  conf.cols.forEach(function(n) {
    head.push(n);
    type.push('HTTP-RET');
  });


  send.setHead(head);
  send.setType(type);

  pre_send(conf);


  return function(data, saver, next) {
    var s = {};

    for (var i=0, e=head.length; i<e; ++i) {
      s[head[i]] = data[i];
    }

    send_data(conf, s, function(err, retdata) {
      if (err) {
        interactive.bizlog('tran', data);
        interactive.log(err.message);

      } else {

        data.length = head.length;
        var r = JSON.parse(retdata);

        for (var n in r) {
          var c = send.getColumn(n);
          if (!isNaN(c)) data[c] = r[n];
        }
        saver(data);
      }

      next();
    });

    return tool.WAIT_NEXT;
  };
}


function pre_send(cf) {
  cf.timeout = (parseInt(cf.timeout) * 1000) || DEF_TIMEOUT * 1000;

  cf.headers = {
    'Content-Type' : 'application/json;' + cf.out_enc
  };
}


function send_data(cf, send_data, rcb) {
  var req = http.request(cf, function(resp) {
    tool.recv_all_data(resp, cf.in_enc, 'UTF-8', rcb);
  });
  req.on('error', rcb);
  req.setTimeout(cf.timeout);
  req.end(JSON.stringify(send_data));
}


function get_url(cf) {
  var url = [ 'http://', cf.host ];

  if (cf.port) {
    url.push(':');
    url.push(cf.port);
  }

  if (cf.path) {
    if (cf.path[0] != '/') url.push('/');
    url.push(cf.path);
  }

  return url.join('');
}