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
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var __NAME  = 'etl-filter-repeat';


module.exports = {
  name          : "去除重复记录",
  groupName     : "数据过滤",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function checkConfig(configJSON, RCB) {
  var ch = checker(configJSON);

  // ch.mustStr('name');
  ch.mustArr('field');
  ch.arrNotRepeat('field');

  if (ch.noError()) {
    tool.zip_arr(configJSON.field);
  }

  // console.log(configJSON);
  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name   : '去除重复记录',
    field  : [],
  };
  RCB(null, conf);
}


//
// 创建比较器, 如果 a b 中的列相同, 则返回 true
//
function create_compare(conf, recv) {
  var head = recv.getHead();
  var findex = [];

  for (var i = 0; i < conf.field.length; ++i) {
    var fname = conf.field[i];

    for (var h = 0; h < head.length; ++h) {
      if (head[h] == fname) {
        findex.push(h);
      }
    }
  }

  var len = findex.length;

  var ret = function(a, b) {
    // console.log('!@', a,b)
    for (var i = 0; i < len; ++i) {
      // console.log("@#", i, a[ findex[i] ] , b[ findex[i] ])
      if ( a[ findex[i] ] == b[ findex[i] ] ) {
        return true;
      }
    }
    return false;
  }

  return ret;
}


function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var runn = true;

  // 没有配置则不做任何过滤, 把输入传入下一个目标
  if (conf.field.length < 1) {
    interactive.runOver(recv);
    return;
  }

  interactive.onStop(function() {
    runn = false;
  });

  var send = recv.clone();
  var tmp1 = recv, tmp2;
  var _compare = create_compare(conf, recv);

  var _do_compare_fn = tool.task_dispatch(_do_compare);
  var _do_recv_fn    = tool.task_dispatch(do_recv, true);


  function do_recv() {
    tmp1.moveto(0);

    if (runn && tmp1.has()) {
      tmp1.next();

      var d = tmp1.getData();
      send.push(d);

      tmp2 = recv.clone();
      _do_compare(d);

    } else {
      interactive.runOver(send);
    }
  }

  function _do_compare(d) {
    if (runn && tmp1.has()) {
      tmp1.next();

      var d1 = tmp1.getData();
      if (!_compare(d, d1)) {
        tmp2.push(d1);
      } else {
        interactive.log('filter', d);
      }

      _do_compare_fn(d);

    } else {

      tmp1 = tmp2;
      _do_recv_fn();
    }
  }
}
