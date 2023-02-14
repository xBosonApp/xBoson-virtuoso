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

var __NAME  = 'etl-ctrl-nul';


module.exports = {
  name          : "空操作",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 3,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 0,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function checkConfig(configJSON, RCB) {
  RCB();
}


function createConfig(RCB) {
  var conf = {
    name: '空操作',
    desc: ''
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  interactive.runOver(interactive.getData());
}
