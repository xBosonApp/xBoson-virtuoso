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


var __NAME  = 'etl-tran-js';


module.exports = {
  name          : "JavaScript",
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
};


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustStr('js');
  var err = ch.getResult();

  if (err != null) {
    return RCB(err);
  }

  var log = [];
  var js = null;

  function _log() {
    for (var i=0; i<arguments.length; ++i) {
      log.push(arguments[i]);
    }
  }

  if (cf._type == 'testjs') {
    try {
      js = tool.createJsbox(cf.js);
      var cols = 0;

      for (var n in cf._parm_) {
        js.set(n, cf._parm_[n]);
        ++cols;
      }

      js.set('log'      , _log);
      js.set('cols'     , cols);
      js.set('rows'     , 1);
      js.set('curr'     , 0);
      js.set('skipcurr' , false);
      // js.set('bizlog'   , _log);

      RCB(null, { retmessage: '完成,' + (js.run() || ''),
                  log: log.join(', ') || '脚本没有产生日志' } );

    } catch(err) {
      RCB({ retmessage: '错误, ' + err.message, log: log.join(', ') });
    } finally {
      js && js.free();
    }
    return;
  }

  RCB();
}


function createConfig(RCB) {
  var conf = {
    name   : 'JavaScript 脚本',
    js     : '',
    _type  : '',
    _parm_ : {},
  };
  RCB(null, conf);
}


function create_filter(conf, recv, send, interactive, event) {
  if (conf.js.length < 1) {
    return tool.NOCHANGE;
  }

  recv.clone(send);

  var js   = tool.createJsbox(conf.js);
  var head = recv.getHead();

  js.set('log'   , _log);
  js.set('cols'  , head.length);
  js.set('rows'  , recv.totalrows());
  // js.set('bizlog', bizlog);


  function _log() {
    var msg = [];
    for (var i=0; i<arguments.length; ++i)
        msg.push(arguments[i]);
    interactive.log('用户日志', msg.join(', '));
  }

  // function bizlog(msg) {
  //   if (msg) conf.bizlog.bl.msg = msg;
  //   interactive.bizlog('bl', recv.getData());
  // }

  event.on('end', function() {
    interactive.runOver(send);
    js.free();
  });

  var box  = js.getbox();
  var l    = head.length;
  var r    = -1;

  return function(data, saver) {
    for (var i=0; i<l; ++i) {
      box[ head[i] ] = data[i];
    }

    box.skipcurr = false;
    box.curr = ++r;
    js.run();

    if (!js.get('skipcurr')) {
      for (var i=0; i<l; ++i) {
        data[i] = box[ head[i] ];
      }

      saver(data);
    }
  };
}
