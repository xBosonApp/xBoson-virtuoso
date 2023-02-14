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


module.exports = {

  name          : "数据库表输入",
  programID     : "__Etl_in_table__",
  configPage    : 'etl-in-table.htm',
  groupName     : "输入",
  className     : 1,
  icon          : 'etl-in-table.png',
  disable       : false,
  parent_max    : 0,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run : run,
};


function createConfig(RCB) {
  var conf = {
    // 用于调用 checkConfig 时传参 'connonly'
    _type       : null,
    name        : '数据库表输入',
    sql         : "select [column]\n  from [table]\n  where [what]",
    limit       : 10,
    table       : ''
  };
  dbtool.init_db_config(conf);
  RCB(null, conf);
}


function checkConfig(cf, RCB) {
  var ch = dbtool.check_config(cf);
  var ret = ch.getResult();

  if (ret == null && cf._type == 'get_tables') {
    return dbtool.get_tables(cf, RCB);
  }

  if (ret == null && cf._type == 'check_conn') {
    dbtool.check_conn(cf, null, RCB);
    return;
  }

  if (ret == null && cf._type == 'gen_sql') {
    dbtool.get_fields(cf, cf.table, function(err, data) {
      if (err) return RCB(err);
      create_sql(cf, data, RCB);
    });
    return;
  }

  ch.mustNum('limit', 1, 100);
  // ch.mustStr('name');
  ch.mustStr('sql');

  if (cf._type == 'check_sql') {
    dbtool.check_conn(cf, function(connect) {
      dbtool.check_sql(connect, cf.sql, RCB);
    }, RCB);
    
    return;
  }

  RCB(ch.getResult());
}


function create_sql(cf, data, RCB) {
  var sql = [ "SELECT \n" ];

  data.fields.forEach(function(f) {
    sql.push("\t");
    sql.push(f.field);
    sql.push(",\n");
  });

  sql.pop();
  sql.push("\n  FROM\n\t");
  sql.push(cf.table);

  RCB(null, { 'retmessage': '成功', 'sql': sql.join('') });
}


function run(interactive, limit, _is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;

  limit = _is_test && conf.limit-1;


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
