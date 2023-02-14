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
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');


module.exports = {
  name          : "列拆分为多行",
  groupName     : "数据转换",
  programID     : "__etl_tran_split__",
  configPage    : 'etl-tran-split.htm',
  className     : 1,
  icon          : 'etl-tran-split.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : tool.create_tran_run(create_filter)
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustStr('fs');
  ch.mustStr('sp');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name : '列拆分为多行',
    fs   : '',
    ft   : '',
    sp   : ''
  };
  RCB(null, conf);
}


function create_filter(conf, recv, send) {
  var head  = recv.getHead();
  var type  = recv.getType();
  var si    = recv.getColumn(conf.fs);
  var ti    = null;

  if (conf.ft) {
    ti = head.length;
    head.push(conf.ft);
    type.push('VARCHAR');
  } else {
    ti = si;
  }

  send.setHead(head);
  send.setType(type);

  return function(data, _saver) {
    var s = String(data[si]);
    var any = s.split(conf.sp);

    if (any.length > 0) {
      for (var i=0; i<any.length; ++i) {
        if (any[i] === '') continue;
        data[ti] = any[i];
        send.push(data);
      }
    } else {
      _saver();
    }
  }
}