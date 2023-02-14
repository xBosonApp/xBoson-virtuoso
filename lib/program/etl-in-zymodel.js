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
var db      = require('db3-lib');
var etype   = require('../type-event.js');
var dbtool  = require('../db-tool.js');
var sysconf = require('configuration-lib').load();


module.exports = {

  name          : "模型输入",
  programID     : "__Etl_in_zymodel__",
  configPage    : 'etl-in-zymodel.htm',
  groupName     : "输入",
  className     : 1,
  icon          : 'etl-in-zymodel.png',
  disable       : sysconf.eeb_zy.has_zy_server == false,
  parent_max    : 0,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run : run,
};


function checkConfig(configJSON, RCB) {
  var ch = dbtool.check_config(configJSON);
  // console.log(configJSON);

  ch.mustNum('limit', 1, 100);
  ch.mustStr('sql');

  var ret = ch.getResult();
  if (ret) {
    ret.retmessage = '配置错误';
    return RCB(ret);
  }

  dbtool.check_conn(configJSON, function(connect) {
    dbtool.check_sql(connect, configJSON.sql, RCB);
  }, RCB);
}


function createConfig(RCB) {
  var conf = {
    name        : '模型输入',
    zy_conn     : '',
    zy_module   : '',
    sql         : '',
    limit       : 10,
    sparm       : {}
  };
  dbtool.init_db_config(conf);
  RCB(null, conf);
}


function run(interactive, limit, _is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;

  limit = _is_test && conf.limit;
  

  dbtool.check_conn(conf, function(connect) {

    interactive.onStop(function() {
      connect.end();
    });

    dbtool.select(conf.sql, connect, limit, function(err, data) {
      if (err) 
        return interactive.sendEvent(etype.ERROR, 
          dbtool.filter_java_exception(err));

      connect.end();

      var msg = '读取数据 ' + data.totalrows() + ' 行';
      interactive.sendEvent(etype.STATISTICS, msg);
      interactive.sendEvent(etype.L_EX_ROWCOUNT, { 
            row_count: data.totalrows(), msg: conf.name });
      interactive.log(msg);
      interactive.runOver(data);
    });

  }, function(err) {
    if (err) interactive.sendEvent(etype.ERROR, 
        dbtool.filter_java_exception(err));
  });
}
