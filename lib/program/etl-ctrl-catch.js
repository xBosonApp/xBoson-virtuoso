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
var event   = require('../type-event.js');
var checker = require('../checker.js');

var __NAME  = 'etl-ctrl-catch';
var YES     = 1;
var NO      = 2;
var ALL     = 2;
var CURR    = 1;
var JUMP    = 1;
var VCHAR   = 'varchar';


module.exports = {
  name          : "捕获异常",
  groupName     : "流控制",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 99,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustNum('do_next',         1, 3);
  ch.mustNum('do_next_data',    1, 3);
  ch.mustNum('do_recove',       1, 3);
  ch.mustNum('do_recove_data',  1, 3);
  ch.mustNum('rollback',        1, 3);
  ch.mustNum('sendlog',         1, 3);
  ch.mustNum('use_err_col',     1, 3);
  ch.mustStr('err_col_name',    1, 99);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name            : '捕获异常',
    do_next         : NO,
    do_next_data    : CURR,
    do_recove       : YES,
    do_recove_data  : NO,
    rollback        : NO,
    sendlog         : NO,
    use_err_col     : YES,
    err_col_name    : 'exception',
  };
  RCB(null, conf);
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var data = interactive.getData();
  var err  = interactive.exception;

  if (conf.sendlog == YES) {
    interactive.log('捕获异常', data.getData());
  }
  do_next();


  function do_next() {
    if (conf.do_next == NO) {
      return rollback();
    }

    var do_next_data;

    if (conf.do_next_data == CURR) {
      do_next_data = interactive.createFlow();
      var rh = data.getHead();
      var rt = data.getType();
      var rd = data.getData();
      if (conf.use_err_col == YES) {
        rh.push(conf.err_col_name + '_message');
        rt.push(VCHAR);
        rd.push(err.message);
        rh.push(conf.err_col_name + '_code');
        rt.push(VCHAR);
        rd.push(err.code);
      }
      do_next_data.setHead(rh);
      do_next_data.setType(rt);
      do_next_data.push(rd);
    } else {
      do_next_data = data;
    }

    interactive.regEvent(event.END, rollback);
    interactive.runOver(do_next_data);
  }


  function rollback() {
    if (conf.rollback == NO) {
      return do_recove();
    }

    interactive.sendEvent(etype.UPDATE_FAIL, do_recove);
  }


  function do_recove() {
    if (conf.do_recove == YES) {
      if (conf.do_recove_data == JUMP) {
        data.next();
      }
      interactive.sendEvent(event.RECOVER_ERROR);
    } else {
      interactive.sendEvent(event.END);
    }
  }
}
