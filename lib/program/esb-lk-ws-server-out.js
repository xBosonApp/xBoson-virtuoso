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
var Iconv   = require('iconv').Iconv;


var __NAME  = 'esb-lk-ws-server-out';
var DEF_CODE  = 'UTF-8';


var pg_cnf = module.exports = {
  name          : "WebService 应答",
  groupName     : "服务",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : 0,
  parent_max    : 1,
  child_max     : 0,

  not_display   : true,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function createConfig(RCB) {
  var cf = {
    name     : pg_cnf.name,
    outn     : [],
    outv     : [],
    outt     : [],  // 仅用于显示
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.outn, cf.outv);

  ch.mustArr('outn');
  ch.mustArr('outv');

  ch.arrNotRepeat('outn');
  ch.arrNotNul('outv');

  RCB(ch.getResult());
}


function run(interactive, limit, is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var stop = false;


  if (is_test) {
    throw new Error('该模块不支持测试');
    return;
  }

  interactive.onStop(function() {
    stop = true;
  });


  if (!stop) {
    var data = recv.getData();
    var head = recv.getHead();
    var outp = {};

    try {
      conf.outv.forEach(function(v, i) {
        var exp  = tool.expression_complier(v, true);
        outp[ conf.outn[i] ] = exp.val(data);
      });
    } catch(err) {
      // tool.esb_error(err, interactive, data);
      interactive.sendError(err, data, null, finallyfn);
      return;
    }

    finallyfn();

    function finallyfn() {
      interactive.sendEvent(etype.SERVEICE_RESPONSE, {
        //
        // 这里定义了 SERVEICE_RESPONSE 消息的数据结构
        //
        data  : recv,
        over  : _over,
        outp  : outp
      });
    }
  }


  function _over(_id) {
    if (stop) return;
    interactive.log('请求处理完成', _id);
    interactive.runOver(recv);
  }
}
