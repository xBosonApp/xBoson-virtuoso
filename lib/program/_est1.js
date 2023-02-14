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


module.exports = {
  // 程序名称
  name      : "测试-无限制",

  // 程序标识, 不能重复
  programID : "__test_target__",

  // 用来修改这个程序配置的页面url, '/' == '/eeb/ui/'
  configPage: 'x-test.htm',

  // 程序分组名称
  groupName : "测试-分组",

  // 程序所属类型 ETL:1, ESB:2, BPM:4; 可以是两种以上
  className : 7,

  // 图标, 基于 www/public/img/target-icon/ 目录
  icon : 'test1.png',

  // 检查配置是否有效, 
  // RCB:err = { 'configname':'msg' } 意思是
  // configname 的配置出现了 msg 的问题
  checkConfig : checkConfig,

  // 初始化一个默认配置, 结果在 RCB:data
  createConfig : createConfig,

  // 正式运行这个任务
  run : run,

  // 禁用这个程序
  disable: true,
  not_display   : true,
}

function checkConfig(configJSON, RCB) {
  var ch = checker(configJSON);

  ch.mustNum('col.0', 9, 99);
  ch.mustNum('col.1');
  ch.mustNum('col.2');
  ch.mustNum('col.3');
  ch.mustStr('name');
  ch.mustStr('id');

  RCB(ch.getResult());
}

function createConfig(RCB) {
  var conf = {
    id: uuid.v4(),
    name: 'hello test',
    col: ['a', 'b', 'c', 'z']
  };
  RCB(null, conf);
}

function run(interactive, limit) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var data = interactive.getData();

  var isetl = (data.className == flow.TYPE.ETL);

  if (!data) {
    data = interactive.createFlow();

    if (isetl) {
      data.setHead(conf.col);
      data.setType(conf.col);
    } else {
      data.setHead({});
    }
  }


  if (isetl) {
    data.push([1,2,3,4]);
  } else {
    var d = data.getData() || {};
    d._tconf = conf;
    data.push(d);
  }


  var ch = interactive.getChildList();
  var nextch = null;

  if (ch.length > 0) {
    nextch = ch[0];
  }

  interactive.log(data.toString());
  interactive.runOver(data, nextch);
}
