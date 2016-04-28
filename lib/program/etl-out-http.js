var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var net     = require('mixer-lib').util.net();

var __NAME  = 'etl-out-http';
var TIMEOUT = 60 * 1000;
// 每次推送的数据量
var PACKAGE_SIZE = 1500;


module.exports = {
  name          : "HTTP 推送",
  groupName     : "输出",
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
    _type    : '',
    name     : 'HTTP 推送',
    host     : '',
    port     : '80',
    path     : '/',
    method   : 'get',
    an       : [],
    av       : [],

    bizlog : {
      http : {
        desc   : '当数据推送失败时, 写错误日志',
        msg    : '数据推送失败',
        enable : false,
      }
    }
  };

  RCB(null, conf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.an, cf.av);

  ch.mustStr('host', 1);
  ch.mustNum('port', 10, 65535);
  ch.mustStr('path', 1);
  // ch.mustStr('method', 1);

  ch.mustArr('an');
  ch.arrNotRepeat('an');
  ch.mustArr('av');

  // if (cf.method != 'post' && cf.method != 'get') {
  //   ch.push('method', '必须是 post 或 get');
  // }

  var res = ch.getResult();

  if (res == null && 'check_conn' == cf._type) {
    var url = get_url(cf);

    send_data(cf.method, url, {'post':'test'}, function(err, retdata) {
      if (err) {
        RCB('连接失败, ' + err.message);
      } else {
        RCB('连接成功, 返回 ' + retdata.txt());
      }
    });
    return;
  }

  RCB(res);
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

  if (cf.an.length > 0) {
    if (cf.path.indexOf('?') < 0) {
      url.push('?');
    } else {
      url.push('&');
    }

    for (var i=0; i<cf.an.length; ++i) {
      url.push(cf.an[i]);
      url.push('=');
      url.push(cf.av[i]);
      url.push('&');
    }
  }

  return url.join('');
}


function send_data(method_not_use, url, send_data, rcb) {
  var req = net.post(url, send_data, function(err, retdata) {
    rcb(err, retdata);
  }, 'json');

  req.setTimeout(TIMEOUT);
}


function create_filter(conf, recv, send, interactive, event) {
  recv.clone(send);

  var url         = get_url(conf);
  var fail        = 0;
  var success     = 0;
  var head        = recv.getHead();
  var cache       = [];


  event.on('end', function() {
    if (cache.length > 0) {
      send_package(cache, _end);
    } else {
      _end();
    }
  });


  function _end() {
    var msg = conf.name + ' 输出数据 ' + recv.totalrows() + ' 行, 成功 '
            + success + ', 失败 ' + fail;

    interactive.sendEvent(etype.STATISTICS, {
      txt   : msg,
      total : recv.totalrows(),
      succ  : success,
      fail  : fail,
    });
    interactive.log(msg);
    interactive.runOver(recv);
  }


  function send_package(data, next) {
    send_data(null, url, data, function(err, ret) {
      if (err) {
        fail += data.length;
        interactive.bizlog('http', data);
      } else {
        success += data.length;
      }
      next();
    });
  }


  return function(d, _, next) {
    var row = {};
    cache.push(row);

    for (var i=0; i<head.length; ++i) {
      row[head[i]] = d[i];
    }

    if (cache.length >= PACKAGE_SIZE) {
      send_package(cache, next);
      cache = [];
      return tool.WAIT_NEXT;
    }
  }
}
