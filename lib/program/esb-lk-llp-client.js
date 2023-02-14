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
var htpool  = require('../http-pool.js');
var net     = require('net');


var __NAME  = 'esb-lk-llp-client';
var _SB     = 0x0B;
var _EB     = 0x1C;
var _CR     = 0x0D;

var _SSB    = String.fromCharCode(0x0B);
var _SEB    = String.fromCharCode(0x1C);
var _SCR    = String.fromCharCode(0x0D);

var _TEXT   = 1;
var _BUFFER = 2;


var pg_cnf = module.exports = {
  name          : "LLP 客户端",
  groupName     : "连接器",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : 0,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function createConfig(RCB) {
  var cf = {
    name     : pg_cnf.name,
    host     : '',
    port     : 6969,
    timeout  : 15, // s
    from     : '',
    to       : 'llp_cli_out',
    otype    : 1,
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);
  ch.mustStr('host', 1, 100);
  ch.mustStr('from', 1, 100);
  ch.mustStr('to',   1, 100);
  ch.mustNum('port', 100, 65535);
  ch.mustNum('timeout', 1, 65535);
  RCB(ch.getResult());
}


function run(interactive, limit, is_test) {
  var root    = interactive.getConfig();
  var conf    = root.run_config;
  var recv    = interactive.getData();
  var data    = recv.getData();
  var txt_mod = parseInt(conf.otype) == _TEXT;


  var oexp  = tool.expression_complier(conf.to, true);
  var exp   = tool.expression_complier(conf.from, true);
  var inval = new Buffer(exp.val(data));


  var sock = net.createConnection(conf.port, conf.host, function() {
    var bufs = [];
    var isbegin = true;

    sock.write(_SSB);
    sock.write(inval);
    sock.write(_SEB);
    sock.write(_SCR);

    sock.on('data', function (buf) {
      if (isbegin) {
        if (buf[0] !== _SB) {
          return sock.destroy();
        }
        isbegin = false;
        buf = buf.slice(1);
      }

      if (  buf[ buf.length-2 ] == _EB 
         && buf[ buf.length-1 ] == _CR) {
        isEnd = true;
        buf = buf.slice(0, buf.length-2);
      }

      bufs.push(buf);

      if (isEnd) {
        _over(null, Buffer.concat(bufs));
      }
    });

  });


  sock.on('timeout', function() {
    _over(new Error('timeout'));
  });


  sock.on('error', _over);
  sock.setTimeout(parseInt(conf.timeout) * 1000);


  function _over(err, rdata) {
    if (err) {
      rdata = err;
      tool.esb_error(err, interactive, data);
      interactive.log('发生错误', err);
    }
    else if (txt_mod) {
      rdata = rdata.toString();
    }
    oexp.val(data, rdata);
    interactive.runOver(recv);
    sock.end();
  }
}
