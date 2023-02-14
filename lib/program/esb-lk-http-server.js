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
var pairpro = require('./esb-lk-http-server-out.js');
var syscnf  = require('configuration-lib').load();
var urllib  = require('url');
var http    = require('http');
var Iconv   = require('iconv').Iconv;

/*
权限认证
HTTP/1.1 401 Unauthorized
Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==
WWW-Authenticate: Basic realm="ESB"
*/

var __NAME    = 'esb-lk-http-server';
var TEXT_MODE = 't';
var JSON_MODE = 'j';
var DEF_CODE  = 'UTF-8';


var pg_cnf = module.exports = {
  name          : "Http 服务端",
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
    port     : syscnf.eeb_zy.http_server_port,
    url      : '/',
    tout     : 15,
    post     : 'n',
    post_t   : TEXT_MODE,
    post_n   : 'post_body',
    encoding : DEF_CODE,
    pn       : [],
    pv       : [],

    use_auth : 'n',
    username : '',
    password : '',
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.pn, cf.pv);

  ch.mustArr('pn');
  ch.mustArr('pv');

  ch.arrNotRepeat('pn');
  // ch.arrNotNul('pv');

  ch.mustNum('port', 100, 65535);
  ch.mustStr('url', 1, 255);
  ch.mustNum('tout', 10, 24*60*60);

  ch.mustStr('post', 1, 2);

  if (cf.use_auth == 'y') {
    ch.mustStr('username', 1, 20);
    ch.mustStr('password', 1, 20);
  }

  if (cf.post == 'y') {
    ch.mustStr('post_t', 1, 2);
    ch.mustStr('post_n', 1, 10);
  }

  if (!cf.encoding) cf.encoding = DEF_CODE;

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

  // htpool.add_mid(conf.url, null, false, request, rcb);
  htpool.get_server(conf.url, conf.port, false, null, request, rcb);
  service_ctx.start('服务在 ' + conf.url + ' 上等待 HTTP 请求');


  //
  // 当有请求发起时被回调
  //
  function request(req, resp, next) {
    if (service_ctx.stop) return next();

    if (conf.use_auth == 'y') {
      if (!http_check_auth(conf, req, resp))
        return;
    }

    //
    // 发送到 flow head 中的数据
    //
    var head   = { resp: resp };
    var data   = { query : req.query, headers : req.headers };
    var remote = resp.socket.remoteAddress + ',' + resp.socket.remotePort;

    data.url   = urllib.parse(req.url, true);
    data.query = data.url.query;

    service_ctx.request(head, remote);


    if (conf.post == 'y') {
      var in_code = (conf.post_t == TEXT_MODE || conf.post_t == JSON_MODE)
                  && conf.encoding;

      tool.recv_all_data(req, in_code, DEF_CODE, function(err, retBuf) {
        if (err)
          tool.esb_error(err, interactive, data);

        if (conf.post_t == JSON_MODE) {
          try {
            data[ conf.post_n ] = JSON.parse(retBuf);
          } catch(_je) {
            data[ conf.post_n ] = retBuf;
            tool.esb_error(_je, interactive, data);
          }
        } else {
          data[ conf.post_n ] = retBuf;
        }
        _over();
      });
    } else {
      _over();
    }


    function _over() {
      var send = interactive.createFlow();
      send.setHead(head);
      send.push(data);
      interactive.runOver(send);
    }
  }


  function response(recv, ret_field, _over) {
    var head = recv.getHead();
    head.resp.end(ret_field);
    _over();
  }


  function rcb(err, closefn) {
    if (err) {
      interactive.sendEvent(etype.ERROR, err);
      return;
    }
    interactive.onStop(closefn);
  }
}


//
// 一旦验证失败, 则要求请求端提供验证参数
//
function http_check_auth(conf, req, resp) {
  var auth = req.headers.authorization || req.headers.Authorization;
  var ok = false, i;
  var B = 'Basic ';

  do {
    if (!auth)
      break;

    i = auth.indexOf(B);
    if (i < 0)
      break;

    auth = auth.substring(B.length);
    auth = new Buffer(auth, 'base64').toString();
    i = auth.indexOf(':');

    if (i < 0)
      break;

    var user = auth.substring(0, i);
    var pass = auth.substring(i+1);
    ok = (pass == conf.password && user == conf.username);

  } while(false);

  if (!ok) {
    resp.statusCode = 401;
    resp.setHeader('WWW-Authenticate', 'Basic realm="ESB HTTP Service"');
    resp.end('Unauthorized');
  }

  return ok;
}


function create_tester(conf, interactive) {
  var url = urllib.parse('http://localhost:80');
  var data = { query : {}, headers : {
      host              : 'localhost',
      connection        : 'keep-alive',
      accept            : 'text/html,application/xml;q=0.9,image/webp,*',
      'user-agent'      : 'Chrome/41.0.2272.118',
      'accept-encoding' : 'gzip, deflate, sdch',
      'accept-language' : 'zh-CN,zh;q=0.8'
    } , url: url };

  var head = { request_id : uuid.v4(), resp: null };


  conf.pn.forEach(function(name, i) {
    data.query[name] = conf.pv[i];
  });

  if (conf.post == 'y' && conf.post_n) {
    data[ conf.post_n ] = '';
  }

  var send = interactive.createFlow();
  send.setHead(head);
  send.push(data);
  interactive.runOver(send);
}
