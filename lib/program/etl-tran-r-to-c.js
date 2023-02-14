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
var __NAME  = 'etl-tran-r-to-c';


var pg_cnf = module.exports = {
  name          : "列转行",
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

  tool.zip_arr(cf.sf, cf.tf, cf.tfv, cf.vf);

  ch.mustArr('sf');
  ch.arrNotRepeat('sf');

  ch.mustArr('tf');
  ch.arrNotNul('tf');

  ch.mustArr('tfv');
  ch.arrNotNul('tfv');

  ch.mustArr('vf');
  ch.arrNotNul('vf');

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name : pg_cnf.name,
    sf   : [],
    tf   : [],
    tfv  : [],
    vf   : []
  };
  RCB(null, conf);
}


function create_filter(conf, recv, send) {
  if (conf.sf.length < 1) {
    return tool.NOCHANGE;
  }

  var head  = recv.getHead();
  var type  = recv.getType();
  var cl    = tool.call_link();
  var columnidx = {};

  conf.tf.forEach(function(tf, i) {
    var si = recv.getColumn(conf.sf[i]);
    var nv = conf.tfv[i];

    var ti = columnidx[tf];
    if (!ti) {
      ti = head.length;
      head.push(tf);
      type.push('VARCHAR');
      columnidx[tf] = ti;
    }

    var vf = conf.vf[i];
    var vi = columnidx[vf];
    if (!vi) {
      vi = head.length;
      head.push(vf);
      type.push(type[si]);
      columnidx[vf] = vi;
    }

    cl.add(function(d, next) {
      var vv = d[si];
      d[ti] = nv;
      d[vi] = vv;
      send.push(d);
      next();
    });
  });

  send.setHead(head);
  send.setType(type);

  return function(d, saver_not_use) {
    cl(d);
  };
}