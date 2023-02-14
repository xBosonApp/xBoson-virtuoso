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
var copy    = require('./etl-ctrl-copy.js');

var __NAME  = 'esb-ctrl-copy';


var pg_cnf = module.exports = {
  name          : "复制",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : copy.configPage, //__NAME + '.htm',
  className     : 2,
  icon          : copy.icon, //__NAME + '.png',
  disable       : 0,
  parent_max    : 1,
  child_max     : 99,

  checkConfig   : copy.checkConfig,
  createConfig  : copy.createConfig,
  run           : copy.run
};

