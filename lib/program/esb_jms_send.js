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
var etype   = require('../type-event.js');
var tool    = require('../program-tool.js');
var checker = require('../checker.js');
var jms     = require('jms-lib');
var http    = require('http');
var uuid    = require('uuid-zy-lib');


var __NAME    = 'esb-jms-send';


var pg_cnf = module.exports = {
  name          : "JMS 发送",
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
    host      : '',
    port      : '',
    driver    : 'ActiveMQ',
    user      : '',
    pass      : '',
    fromvar   : '',
    qname     : '',
    mode      : 'q',
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);
  ch.mustStr('host', 1);
  ch.mustStr('driver', 1);
  ch.mustNum('port', 10, 65535);
  ch.mustStr('fromvar', 1);
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
  var recv    = interactive.getData();
  var data    = recv.getData();
  var checkid = {};


  try {

    var conn = jms.open(conf);
    var sess = conn.createSession();
    var prod = sess.createProducer(conf.qname, conf.mode == 't');

    // if (!is_test) { 测试时也会发送数据
      var expin2 = tool.expression_complier(conf.fromvar, true);
      vin = expin2.val(data);
      prod.send(vin);
    // }

    conn.close();

  } catch(err) {
    var msg = tool.filter_jms_error(err);
    tool.esb_error(new Error(msg), interactive, data);
  }
    
  interactive.runOver(recv);
}