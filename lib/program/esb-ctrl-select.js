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
var select  = require('./etl-ctrl-select.js');


var __NAME  = 'esb-ctrl-select';


var pg_cnf = module.exports = {
  name          : "选择",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : select.configPage,
  className     : 2,
  icon          : select.icon,
  disable       : 0,
  parent_max    : 1,
  child_max     : 99,

  checkConfig   : select.checkConfig,
  createConfig  : select.createConfig,
  run           : run
};


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();


  var nextpath = conf.def_next;


  try {
    var expin = tool.expression_complier(conf.field, true);
    var a = expin.val(data);
    var len = conf.comp.length;
    var opt = select.operator;


    for (var i = 0; i < conf.comp.length; ++i) {
      var b = conf.f_val[i];

      if (!b) {
        var exp = tool.expression_complier(conf.cfield[i], true);
        b = exp.val(data);
      }

      var op = opt[ conf.comp[i] ];
      if ( op(a,b) ) {
        nextpath = conf.next[i];
        break;
      }
    }

  } catch(err) {
    tool.esb_error(err, interactive, data);
  }


  interactive.runOver(recv, nextpath);
}
