var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var Iconv   = require('iconv').Iconv;
var qs      = require('querystring');
var http    = require('http');


var __NAME    = 'esb-lk-http-client';
var DEF_CODE  = 'UTF-8';
var TEXT_MODE = 't';
var TIMEOUT   = 60 * 1000;


var pg_cnf = module.exports = {
  name          : "Http 客户端",
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

  tool.zip_arr(cf.pn, cf.pv);
  tool.zip_arr(cf.hn, cf.hv);

  ch.mustArr('pn');
  ch.mustArr('pv');
  ch.arrNotRepeat('pn');

  ch.mustArr('hn');
  ch.mustArr('hv');
  ch.arrNotRepeat('hn');

  ch.mustNum('port', 10, 65535);
  ch.mustStr('host', 1, 255);
  ch.mustStr('path', 1, 255);
  ch.mustStr('method', 1, 6);
  ch.mustStr('fout', 1, 255);

  if (!cf.encoding) cf.encoding = DEF_CODE;
  if (!cf.post_t) cf.post_t = TEXT_MODE;

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    name     : pg_cnf.name,
    host     : 'localhost',
    port     : '80',
    path     : '/',
    method   : 'GET',
    encoding : DEF_CODE,
    post_t   : TEXT_MODE,

    fout     : '',
    pn       : [],
    pv       : [],

    hn       : [],
    hv       : [],

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


function run(interactive, limit) {
  var root  = interactive.getConfig();
  var conf  = root.run_config;
  var recv  = interactive.getData();
  var data  = recv.getData();
  var iconv = null;
  var oconv = null;

  if (DEF_CODE != conf.encoding) {
    try {
      oconv = new Iconv(DEF_CODE, conf.encoding);
    } catch(err) {
      tool.esb_error(err, interactive, data);
    }
  }

  //
  // 从流中取得值组成请求参数
  //
  var query = {};

  conf.pn.forEach(function(n, i) {
    try {
      var exp = tool.expression_complier(conf.pv[i], true);
      query[n] = exp.val(data);

      if (oconv) {
        // 把请求参数转换为目标编码
        query[n] = oconv.convert(query[n]);
      }
    } catch(err) {
      tool.esb_error(err, interactive, data);
    }
  });


  var querystr = qs.stringify(query);
  var psp = conf.path.indexOf('?') >= 0 ? '&' : '?';

  var options = {
    hostname  : conf.host,
    port      : conf.port,
    path      : conf.path + psp + querystr,
    method    : conf.method,
  };


  //
  // 设置头域
  //
  try {
    var headers = {};
    var hcount = 0;

    conf.hn.forEach(function(h, i) {
      var exp = tool.expression_complier(conf.hv[i], true);
      headers[h] = exp.val(data);
      ++hcount;
    });

    if (hcount > 0) {
      options.headers = headers;
    }
  } catch(err) {
    tool.esb_error(err, interactive, data);
  }


  //
  // 输出变量
  //
  var fout = null;

  try {
    var exp = tool.expression_complier(conf.fout, true);
    fout = exp.val(data, {});
  } catch(err) {
    tool.esb_error(err, interactive, data);
    //
    // 如果出错，在这里结束
    //
    return _over();
  }


  var req = http.request(options, function(resp) {
    fout.headers = resp.headers;
    fout.code    = resp.statusCode;
    fout.query   = query;

    var in_code = (conf.post_t == TEXT_MODE) && conf.encoding;

    tool.recv_all_data(resp, in_code, DEF_CODE, function(err, retBuf) {
      if (err) tool.esb_error(err, interactive, data);
      fout.body = retBuf || {};
      _over();
    });
  });


  req.on('error', function(err) {
    tool.esb_error(err, interactive, data);
    _over();
  });

  req.setTimeout(TIMEOUT);
  req.end();


  function _over() {
    interactive.runOver(recv);
  }
}
