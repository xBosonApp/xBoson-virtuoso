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

var __NAME  = 'template';


module.exports = {
  name          : "模板",
  groupName     : "测试-分组",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : true,
  parent_max    : 0,
  child_max     : 0,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  // ch.mustNum('col.0', 9, 99);
  // ch.mustStr('id');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    // id: uuid.v4(),
    // name: 'hello test',
    // col: ['a', 'b', 'c', 'z']
  };
  RCB(null, cf);
}


//
// run 抛出的异常, interactive.sendError(errObj, data, code),
// interactive.sendEvent(ev.ERROR, ...)
//   发出的异常被首先进入当前目标的异常流, 如果没有配置, 则发送到异常链, 最后被系统捕获
//
// interactive.bizlog((name, data)
//   是 sendEvent 的包装器
//
// interactive.log(msg, data)
//   记入日志但不发送任何消息
//
function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var send = interactive.createFlow();

  send.setHead(['ok', new Date(), conf.id, conf.name]);
  send.push(   [   1,          2,       3,         4]);

  var ch = interactive.getChildList();
  var nextch = (ch.length > 0) && (nextch = ch[0]);

  interactive.runOver(send, nextch);

  interactive.onStop(function() {
    // clearTimeout(timeid);
  });
}
