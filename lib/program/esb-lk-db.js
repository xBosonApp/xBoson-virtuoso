var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var dbtool  = require('../db-tool.js');
var format  = require('string-format');

var __NAME  = 'esb-lk-db';


var pg_cnf = module.exports = {
  name          : "数据库",
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


function checkConfig(cf, RCB) {
  var ch = dbtool.check_config(cf);
  var ret = ch.getResult();

  if (ret == null) {
    if (cf._type == 'get_tables') {
      return dbtool.get_tables(cf, RCB);
    }

    if (cf._type == 'check_conn') {
      dbtool.check_conn(cf, null, RCB);
      return;
    }

    if (cf._type == 'gen_sql') {
      dbtool.get_fields(cf, cf.table, function(err, data) {
        if (err) return RCB(err);
        RCB(null, { 'retmessage': '成功', 'table': cf.table, 'columns': data.fields });
      });
      return;
    }
  }

  ch.mustStr('sql', 1);
  ch.mustStr('fout', 1);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    // 用于调用 checkConfig 时传参 'connonly'
    _type       : null,
    name        : pg_cnf.name,
    sql         : "select [column]\n  from [table]\n  where [what]",
    table       : '',
    fout        : '',
  };

  dbtool.init_db_config(conf);
  RCB(null, conf);
}


function run(interactive) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();

  var expout = tool.expression_complier(conf.fout, true);
  var sql = format(conf.sql, data);

  interactive.log(sql);


  dbtool.check_conn(conf, function(connect) {

    interactive.onStop(function() {
      connect.end();
    });

    dbtool.update(sql, connect, function(err, rows, meta) {
      connect.end();

      if (err) {
        tool.esb_error(err, interactive, data);
      } else try {
        //
        // 决定了返回数据的类型
        //
        expout.val(data, {
          className : 'table-direct',
          sql : sql,
          head: meta,
          data: rows
        });
      } catch(err) {
        tool.esb_error(err, interactive, data);
      }

      interactive.runOver(recv);
    });

  }, function(err) {
    tool.esb_error(err, interactive, data);
    interactive.runOver(recv);
  });
}
