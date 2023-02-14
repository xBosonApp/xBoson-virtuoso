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
var later   = require('later');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');


var __NAME  = 'esb-lk-timer';
later.date.localTime();


var pg_cnf = module.exports = {
  name          : "定时器",
  groupName     : "服务",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : 0,
  parent_max    : 0,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function createConfig(RCB) {
  var cf = {
    name  : pg_cnf.name,
    type  : [],
    unit  : [],
    value : [],
    disp  : [],
  };
  RCB(null, cf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.value, cf.type, cf.unit, cf.disp);
  ch.arrNotNul('type');
  ch.arrNotNul('unit');

  ch.mustArr('type');
  ch.mustArr('unit');
  ch.mustArr('value');

  var sche = later.parse.text(getSche(cf));
  var next = later.schedule(sche).next(5);

  if (!next) {
    ch.push('retmessage', '错误: 必须设置一个有效的时间条件');
  }

  RCB(ch.getResult());
}


function getSche(cf) {
  var sche = [];
  var _ = function(t) { sche.push(t); return _; };

  for (var i=0, e=cf.type.length; i<e; ++i) {
    _(cf.type[i]);
     (cf.value[i] != '--') && _(cf.value[i]);
    _(cf.unit[i]);
  }

  return sche.join(' ');
}


function run(interactive, limit, is_test) {
  var root  = interactive.getConfig();
  var conf  = root.run_config;

  var sche  = later.parse.text(getSche(conf));
  var timer = later.setInterval(_start, sche);
  var nexttimes = 5;

  if (is_test) {
    nexttimes = 30;
    return _start();
  }


  interactive.sendEvent(etype.STATISTICS, {txt:'定时器服务启动'});
  interactive.sendEvent(etype.STATISTICS_END);
  tool.loop_event(interactive, etype.END, when_end);


  interactive.onStop(function() {
    timer && timer.clear();
  });


  function _start() {
    var send = interactive.createFlow();
    var next = later.schedule(sche).next(nexttimes);
    var nexs = [];
    var data = { now: new Date().toLocaleString(), next: nexs };

    next.forEach(function(d, i) {
      nexs[i] = d.toLocaleString();
    });

    send.setHead({});
    send.setType({});
    send.push(data);
    interactive.log('定时到达', '下次:' + nexs[1]);
    interactive.runOver(send);

    interactive.sendEvent(etype.SERVICE_BEG_LOG, 
        { time: Date.now(), request_id: uuid.v1(), msg: '' });
  }


  function when_end() {
    /* do nothing */
  }
}
