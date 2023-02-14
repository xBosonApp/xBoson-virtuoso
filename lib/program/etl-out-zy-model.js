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
var db      = require('db3-lib');
var etype   = require('../type-event.js');
var dbtool  = require('../db-tool.js');
var tool    = require('../program-tool.js');
var sysconf = require('configuration-lib').load();

var NAME = 'etl-out-zy-model';
var SP = '';

var select_table = {
  'mysql'     : 'show tables',
  'oracle'    : 'select TABLE_NAME from user_tab_comments ',
  'sqlserver' : "select name from sysobjects where xtype='U'"
};


module.exports = {
  name          : "模型输出",
  groupName     : "输出",
  programID     : "__" + NAME + "__",
  configPage    : NAME + '.htm',
  className     : 1,
  icon          : NAME + '.png',
  disable       : sysconf.eeb_zy.has_zy_server == false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function createConfig(RCB) {
  var conf = {
    // 用于调用 checkConfig 时传参 'connonly'
    _type       : null,

    name        : '模型输出',
    zy_conn     : '',
    zy_module   : '',
    sql         : '',

    // 列映射关系
    mapping : {
      /* 'target_column_name' : 'src_column_name' */
    },
  };

  dbtool.init_db_config(conf);
  RCB(null, conf);
}


function checkConfig(configJSON, RCB) {
  var ch = dbtool.check_config(configJSON);
  var ret = ch.getResult();

  if (ret == null && configJSON._type == 'check_conn') {
    return dbtool.check_conn(configJSON, null, RCB);
  }

  return RCB(ret);
}


function parseSql(conf) {
  var sql     = conf.sql;
  var lk      = tool.call_link();
  var parm    = {};
  var pcount  = 0;
  var b       = 0;
  var e       = sql.indexOf('?');

  while (b < e) {
  (function() {
    createSubstr(sql, b, e);

    // 检索 ? 并记录位置
    var i = pcount;

    lk.add(function(res, next) {
      res.push("'");
      res.push(parm[i]);
      res.push("'");
      next();
    });

    b = e + 1;
    e = sql.indexOf('?', b);

    ++pcount;
  })();
  }

  if (b < sql.length) {
    createSubstr(sql, b);
  }

  // 设置绑定参数的值
  lk.setParm = function(index, val) {
    parm[index] = val;
  };

  lk.parmcount = pcount;

  // txt 可以包含 {...}
  function createSubstr(txt, b, e, skip) {
    var sub = txt.substring(b, e);

    if (!skip) {
      // 检测 {...} 表达式并编译到 sql 构造链中
      var i = sub.indexOf('{');
      if (i > 0) {
        var j = sub.indexOf('}', i);
        if (j > 0) {
          createSubstr(sub, 0, i, true);

          var name = sub.substring(i+1,j).trim();

          lk.add(function(res, next) {
            res.push("'");
            res.push(parm[name]);
            res.push("'");
            next();
          });

          createSubstr(sub, j+1);
          return;
        }
      }
    }

    lk.add(function(res, next) {
      res.push(sub);
      next();
    });
  }

  return lk;
}


function create_parm_bind(conf, data, sqlbuilder) {
  var head = data.getHead();
  var lk   = tool.call_link();

  for (var tag in conf.mapping) {
    bind(tag, conf.mapping[tag]);
  }

  function bind(tag, src) {
    var si  = data.getColumn(src);

    lk.add(function(row, next) {
      sqlbuilder.setParm(tag, row[si]);
      next();
    });
  }

  return lk;
}


function run(interactive, limit) {

  var root = interactive.getConfig();
  var conf = root.run_config;
  var data = interactive.getData();

  var sqlbuilder = parseSql(conf);
  var parmbind = create_parm_bind(conf, data, sqlbuilder);


  dbtool.check_conn(conf, function(connect) {

    interactive.sendEvent(etype.BEGIN_UPDATE, connect);

    interactive.onStop(function() {
      connect.end();
    });

    var updater  = dbtool.update_use_interactive(interactive, connect, true);
    var _do_loop = tool.task_dispatch(do_loop, true);


    function do_loop() {
      if (!data.has()) {
        updater.log_count(data.totalrows(), conf.name);
        interactive.runOver(data);
        connect.end();
        return;
      }

      data.next();
      parmbind(data.getData());

      var sql = [];

      sqlbuilder(sql, function(_sql) {
        updater(_sql.join(SP), _do_loop, null, data);
      });
    }

  }, function(err) {
    if (err) interactive.sendError(dbtool.filter_java_exception(err));
  });
}
