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
var path    = require('path');
var csv     = require('csv');
var fs      = require('fs');
var Iconv   = require('iconv').Iconv;
var qs      = require('querystring');

var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var fpool   = require('../file-pool.js');
var iid     = require('../instanceid.js');

var __NAME        = 'etl-out-csv';
var SRC_ENCODING  = 'utf-8';
var NEED_HEAD     = '1';


module.exports = {
  name          : "CSV 文件输出",
  groupName     : "输出",
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

  ch.mustStr('out_file', 1);
  ch.mustStr('encoding', 1);
  ch.mustNum('need_head');

  var i = cf.out_file.toLowerCase().lastIndexOf('.csv');
  if (i > 0) {
    cf.out_file = cf.out_file.substring(0, i);
  }

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var d = new Date();

  var buf = [ '创建于[',
      d.getFullYear(), '-', d.getMonth()+1, '-', d.getDate(), ',',
      d.getHours(), "`", d.getMinutes(), "`", d.getSeconds(), ']' ];

  var conf = {
    name      : 'CSV 文件输出',
    out_file  : buf.join(''),
    need_head : '1', // 1:需要, 0:不需要
    encoding  : 'UTF-8',
  };

  RCB(null, conf);
}


function create_filter(conf, recv, send, interactive, fevent) {
  recv.clone(send);

  var stringifier = csv.stringify();
  var dispname    = conf.out_file + '.csv';
  var fname       = conf.out_file + '-[' + uuid.v1() + '].csv';
  var fpath       = path.join(fpool.base, fpool.fix, fname);
  var writer      = fs.createWriteStream(fpath);


  // 不使用默认的关闭行为
  fevent.on('end', _end);
  interactive.onStop(_end);


  stringifier.on('error', function(err){
    interactive.sendEvent(etype.ERROR, err);
  });

  if (SRC_ENCODING != conf.encoding) {
    var iconv = new Iconv(SRC_ENCODING, conf.encoding);

    iconv.on('error', function(err) {
      interactive.sendEvent(etype.ERROR, err);
    });

    stringifier.pipe(iconv).pipe(writer);
  } else {
    stringifier.pipe(writer);
  }

  if (conf.need_head == NEED_HEAD) {
    stringifier.write( recv.getHead() );
  }


  function _end() {
    stringifier.end();
    stringifier.unpipe();

    writer.end(function() {
      iid.getnodeid(function(err, nid) {
        var url = '/eeb/service?fn=fp_get&fix=1&fname='
                + qs.escape(fname) + '&tname=' + qs.escape(dispname)
                + '&nodeid=' + nid;

        _log(conf.name + ' 输出数据 ' + recv.totalrows() + ' 行');
        _log("<html>文件输出到 <a href='" + url + "'>" + dispname + "</a></html>");

        //
        // 必须等待文件完全写出后, 才发送关闭消息
        //
        interactive.runOver(recv);
      });
    });
  }

  function _log(msg) {
    interactive.sendEvent(etype.STATISTICS, {
      txt   : msg,
      total : recv.totalrows(),
      succ  : recv.totalrows(),
      fail  : 0
    });
    interactive.log(msg);
  }

  return function(d) {
    stringifier.write(d);
  }
}
