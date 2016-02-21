var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var dbtool  = require('../db-tool.js');
var format  = require('string-format');
var sysconf = require('configuration-lib').load();

var __NAME  = 'esb-lk-module';


var pg_cnf = module.exports = {
  name          : "模型",
  groupName     : "连接器",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 2,
  icon          : __NAME + '.png',
  disable       : sysconf.eeb_zy.has_zy_server == false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


function checkConfig(cf, RCB) {
  var ch = dbtool.check_config(cf);
  // console.log(configJSON);

  // ch.mustNum('limit', 1, 100);
  ch.mustStr('sql', 1);
  ch.mustStr('fout', 1);

  var ret = ch.getResult();
  if (ret) {
    ret.retmessage = '配置错误';
    return RCB(ret);
  }

  dbtool.check_conn(cf, function(connect) {
    // dbtool.check_sql(connect, cf.sql, RCB);
    RCB();
    connect.end();
  }, RCB);
}


function createConfig(RCB) {
  var conf = {
    name        : '模型输入',
    zy_conn     : '',
    zy_module   : '',
    sql         : '',
    limit       : 10,
    sparm       : {},
    fout        : '',

    bizlog : {
      err : {
        desc   : '当处理数据失败时, 写错误日志',
        msg    : '失败',
        enable : false,
      }
    }
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
