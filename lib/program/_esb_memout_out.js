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
var advtool = require('masquerade-html-lib').tool;


var __NAME  = 'esb-memout-out';
var DEF_CODE  = 'UTF-8';


var pg_cnf = module.exports = {
  name          : "ESB 内存溢出2",
  groupName     : "连接器",
  programID     : "__" + __NAME + "__",
  configPage    : 'x-test.htm',
  className     : 2,
  icon          : 'esb-test-print.png',
  disable       : true,
  parent_max    : 1,
  child_max     : 0,

  not_display   : true,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run,
};



function createConfig(RCB) {
  var cf = {
    name : pg_cnf.name,
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  RCB();
}

var count = 1;


function run(interactive, limit, is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();
  var head = recv.getHead();
  
  count++;

  // 频繁的加入闭包而不删除导致溢出, 已经修正内核
  interactive.onStop(function() {
    // stop = true;
  });


  interactive.sendEvent(etype.SERVEICE_RESPONSE, {
    //
    // 这里定义了 SERVEICE_RESPONSE 消息的数据结构
    //
    data      : recv,
    over      : _over,
    ret_field : 'is memout test ' + count,
  });


  function _over(_id) {
    // console.log('请求处理完成', _id);
    interactive.runOver(recv);
  }
}