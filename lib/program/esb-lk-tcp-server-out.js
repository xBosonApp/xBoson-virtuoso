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


var __NAME  = 'esb-lk-tcp-server-out';


var pg_cnf = module.exports = {
  name          : "TCP 结束",
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
  run           : run,
};


function createConfig(RCB) {
  var cf = {
    name     : pg_cnf.name,
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  RCB(null);
}


function run(interactive, limit, is_test) {
  var root = interactive.getConfig();


  if (is_test) {
    throw new Error('该模块不支持测试');
    return;
  }

  var out_ctx = tool.create_esb_service_out_context(interactive);


  if (!out_ctx.stop) {
    out_ctx.end(null);
  }
}
