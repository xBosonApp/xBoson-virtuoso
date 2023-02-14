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
var loop    = require('./etl-ctrl-loop.js');
var util    = require('util');

var __NAME  = 'esb-ctrl-loop';


var pg_cnf = module.exports = {
  name          : "循环",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : loop.icon,
  disable       : 0,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustStr('fin', 1, 99);
  ch.mustStr('fout', 1, 99);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    name : pg_cnf.name,
    fin  : '',
    fout : '',
  };
  RCB(null, cf);
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();

  var expout  = null;
  var looparr = [];


  try {
    var expin  = tool.expression_complier(conf.fin,  true);
    var ld = expin.val(data);
    expout = tool.expression_complier(conf.fout, true);

    if (typeof ld == 'object') {
      if (util.isArray(ld)) {
        ld.forEach(function(v, k) {
          looparr.push({ k:k, v:v });
        });
      } else {
        for (var k in ld) {
          looparr.push({ k:k, v:ld[k] });
        }
      }
    } else {
      looparr.push({ k:conf.fin, v:ld });
    }
  } catch(err) {
    tool.esb_error(err, interactive, data);
  }


  var i = 0;
  _loop();


  function _loop() {
    if (i+1 < looparr.length) {
      interactive.regEvent(etype.END, function() {
        ++i;
        _loop();
      });
    }

    try {
      expout.val(data, looparr[i]);
    } catch(err) {
      tool.esb_error(err, interactive, data);
    }

    interactive.runOver(recv);
  }
}
