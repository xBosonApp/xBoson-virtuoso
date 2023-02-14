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
var __NAME  = 'etl-tran-seq';


module.exports = {
  name          : "增加序列",
  groupName     : "数据转换",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : tool.create_tran_run(create_filter)
}

function checkConfig(cf, RCB) {
  var ch = checker(cf);

  // ch.mustStr('name');
  ch.mustStr('field');
  ch.mustNum('begin', 0, Number.MAX_VALUE);
  ch.mustNum('end', cf.begin, Number.MAX_VALUE);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name  : '增加序列',
    field : '',
    begin : 0,
    end   : 1
  };
  RCB(null, conf);
}


function create_filter(conf, recv, send) {
  var head  = recv.getHead();
  var type  = recv.getType();

  var fi = head.length;
  head.push(conf.field);
  type.push('DECIMAL');

  send.setHead(head);
  send.setType(type);

  var b = conf.begin;
  var e = conf.end;
  var c = b;

  return function(data, saver) {
    data[fi] = c;
    if (++c > e) c = b;
    saver(data);
  };
}
