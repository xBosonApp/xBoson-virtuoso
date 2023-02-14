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
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var uuid    = require('uuid-zy-lib');
var http    = require('http');
var sysconf = require('configuration-lib').load();
var ulib    = require('url');


var __NAME  = 'etl-ctrl-runetl';


var prog = module.exports = {
  name          : "启动 ETL 作业",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 3,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function checkConfig(cf, RCB) {
  var ch = checker(cf, {
    wid : '必须选择集群节点',
    jid : '必须选择作业',
  });

  ch.mustStr('wid', 32);
  ch.mustStr('jid', 32);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name : prog.name,
    wid  : '',
    jid  : '',
    port : 0,
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  var data = interactive.getData();
  var root = interactive.getConfig();
  var conf = root.run_config;

  var wsurl = ulib.parse(sysconf.eeb_zy.ws_client.server_url);
  var url = [
    'http://', wsurl.hostname, ':', conf.port, 
    '/eeb/service?fn=_start_sche', 
    '&wid=', conf.wid, '&jid=', conf.jid
  ];


  http.get(url.join(''), function(res) {
    tool.recv_all_data(res, null, null, function(err, buf) {
      try {
        var msg = JSON.parse( buf.toString() );
        response(null, msg);  
      } catch(e) {
        response(e) ;
      }
    });
  }).on('error', function(e) {
    response(e);
  });


  function response(err, ret) {
    if (err && (ret.ret != 0)) {
      interactive.log('任务启动失败', err ? err.message : ret.msg);
    } else {
      interactive.log('ETL 任务启动', ret.msg + ' [' + ret.job_id + ']'); 
    }
    interactive.runOver(data);  
  }
}
