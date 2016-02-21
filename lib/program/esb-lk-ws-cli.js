var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var soap    = require('soap');
var http    = require('http');
var fs      = require('fs');

var _soap_client = null;
var TIMEOUT      = 60 * 1000;
var __NAME       = 'esb-lk-ws-cli';


var pg_cnf = module.exports = {
  name          : "WebService 客户端",
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


function createConfig(RCB) {
  var cf = {
    name      : pg_cnf.name,
    wsdl_xml  : '',
    wsdl_url  : '',
    wsdl_file : '',
    soap_fn   : '', // 保存了一个 JSON: [服务,端口,函数]
    soap_in   : {},
    fout      : '',

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


function checkConfig(cf, RCB) {
  var ch = checker(cf);


  switch(cf._type) {

  case 'fromurl':

    ch.mustStr('wsdl_url', 1, 255, function(url) {
      getXmlFromUrl(url, retrcb)
    });
    return ch.noError() || RCB(ch.getResult());

  case 'fromfile':

    ch.mustStr('wsdl_file', 1, 255, function(fpath) {
      fs.readFile(fpath, { encoding : 'utf-8' }, retrcb);
    });
    return ch.noError() || RCB(ch.getResult());

  case 'parse_wsdl':

    ch.mustStr('wsdl_xml', 1, undefined, function(xml) {
      getServiceDesc(xml, cf.fromurl, retrcb);
    });
    return ch.noError() || RCB(ch.getResult());
  }


  ch.mustStr('wsdl_xml', 1);
  ch.mustStr('soap_fn', 1);
  ch.mustStr('fout', 1);
  // ch.mustArr('soap_in', 1);

  RCB(ch.getResult());


  function retrcb(err, data) {
    if (err) RCB({'retmessage': '失败, ' + (err.message || err)});
    else     RCB(null, {'ret' : data});
  }
}


function getServiceDesc(xml, uri, rcb) {
  createClient(xml, uri, function(err, client) {
    if (err) return rcb(err);
    var desc = client.describe();
    // console.log(JSON.stringify(desc, null, 2));
    rcb(null, desc);
  });
}


//
// 使用 xml 创建 ws 客户端, uri 可以为空
// 如果 xml 有 include 语法, 则 uri 需要指定
//
function createClient(xml, uri, rcb) {
  tool.soapClientClass(function(err, Client) {
    if (err) return rcb(err);

    var options = {};
    var wsdl = new soap.WSDL(xml, uri, options);

    wsdl.onReady(function(err, _wsdl) {
      if (err) return rcb(err);

      var client = new Client(_wsdl, null, options);
      rcb(null, client);
    });    
  });
}


function getXmlFromUrl(url, rcb) {
  var req = http.request(url, function(resp) {
    tool.recv_all_data(resp, 'UTF-8', null, function(err, xml) {
      if (err) return rcb(err);
      rcb(null, xml);
    });
  });

  req.on('error', rcb);
  req.end();
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();

  // 没有机会停止

  try {
    var exp = tool.expression_complier(conf.fout, true);
    var call = JSON.parse(conf.soap_fn);
    var parm = {};

    for (var n in conf.soap_in) {
      var p = tool.expression_complier(conf.soap_in[n], true);
      parm[n] = p.val(data);
    }

    createClient(conf.wsdl_xml, conf.wsdl_url, function(err, client) {
      if (err) return over(err);

      var input = client.wsdl.definitions.services[ call[0] ]
                        .ports[ call[1] ]
                        .binding.methods[ call[2] ].input;

      // 修正方法名没有名字空间的情况
      if (input.$type) input.$name = input.$type;
      
      var fn = client[ call[0] ][ call[1] ][ call[2] ];

      service_fn(fn)(parm, function(err, result) {
        if (err) return over(err);

        exp.val(data, result);
        over();
      });
    });

  } catch(err) {
    //
    // 如果出错，在这里结束
    //
    return over(err);
  }

  //
  // 包装函数, 并设置一个超时
  //
  function service_fn(fn) {
    return function(parm, rcb) {
      var is_timeout = false;

      var tid = setTimeout(function() {
        is_timeout = true;
        rcb(new Error("timeout"));
      }, TIMEOUT);

      fn(parm, function(err, res) {
        clearTimeout(tid);
        
        if (is_timeout) {
          console.log('web service timeout but get data', err || res);
        } else {
          rcb(err, res);
        }
      });
    };
  }

  function over(err) {
    if (err) {
      tool.esb_error(err, interactive, data);
    }
    interactive.runOver(recv);
  }
}
