var db      = require('db3-lib');
var checker = require('./checker.js');
var flow    = require('./flow-data.js');
var etype   = require('./type-event.js');
var logger  = require('logger-lib')('db-speed');


module.exports = {
  check_conn              : check_conn,
  init_db_config          : init_db_config,
  check_config            : check_config,
  check_sql               : check_sql,
  select                  : select,
  update                  : update,
  filter_java_exception   : filter_java_exception,
  get_tables              : get_tables,
  get_fields              : get_fields,
  check_table_mapping     : check_table_mapping,
  update_use_interactive  : create_update_use_interactive
};

var SP = ' ';

var select_table = {
  'mysql'     : 'show tables',
  'oracle'    : 'select TABLE_NAME from user_tab_comments',
  'sqlserver' : "select name from sysobjects where xtype='U'"
};


//
// 检查连接是否正确, 失败调用 RCB(err), 成功, 如果设置 next 则调用
// 否则调用 RCB(null, message)
// next: Function(db_connect)
// RCB : Function(error, success_message)
//
function check_conn(configJSON, next, RCB) {
  var driver = db.createDriver(configJSON.conn);

  if (!RCB) {
    RCB = function(err) {
      console.log('error', err);
    }
  }

  driver.connect(function(err, connect) {
    if (err) {
      RCB({'retmessage': '连接失败, ' + filter_java_exception(err)});
      return;
    }

    if (next) {
      try {
        next(connect);
      } catch(err0) {
        RCB(err0);
      }
    } else {
      RCB(null, {'retmessage': "数据库连接成功"});
      connect.end();
    }
  });
}


//
// 检查配置字段的字面有效性, 并返回 checker
//
function check_config(configJSON) {
  var ch = checker(configJSON);
  ch.mustNum('conn.port', 99, 65535);
  ch.mustStr('conn.host');
  ch.mustStr('conn.user');
  ch.mustStr('conn.driver');

  return ch;
}


//
// 在 configJSON 中附加 DB 配置
// 必须有配置: configJSON.conn
//
function init_db_config(configJSON) {
  configJSON.conn = {
    host     : 'localhost',
    user     : 'root',
    password : '',
    port     : '',
    database : '',
    driver   : 'mysql'
  };
}


//
// 检查 sql 是否能执行, 但不会修改数据
//
function check_sql(connect, sql, RCB) {
  connect.beginTran(function(err) {
    if (err) {
      return RCB({'retmessage': 'SQL 失败, ' + err.message});
    }

    select(sql, connect, 5, function(err, data) {
      if (err) {
        var msg = filter_java_exception(err);
        return RCB({'retmessage': 'SQL 失败, ' + msg});
      }

      RCB(null, {'retmessage': 'SQL 成功执行'});

      connect.rollback(function(err) {
        connect.end();
      });
    });

  });
}


//
// java 的错误会设置整个堆栈到 message 中, 过滤它
//
function filter_java_exception(err) {
  if (!err.message) return err;

  var msg = err.message;
  var f = _filter('java.sql', ':', 'at');

  if (!f) f = _filter('jdbc', ':', "\n");

  function _filter(begin_str, split_str, end_str) {
    var i = msg.indexOf(begin_str);
    if (i >= 0) {
      i = msg.indexOf(split_str, i);
      if (i > 0) {
        ++i;
        var e = msg.indexOf(end_str, i);
        if (e > i) {
          msg = msg.substring(i, e);
          return true;
        }
      }
    }
  }

  return msg;
}


//
// 包装一个 RCB 回调, 当出错时过滤错误信息
//
function java_err_rcb(rcb) {
  return function(err, d) {
    if (err) {
      rcb(filter_java_exception(err));
      return;
    }
    rcb(null, d);
  }
}


//
// 执行查询 sql, 返回数据, connect 在外面关闭
// _RCB(error, flow_data)
//
function select(sql, connect, limit, _RCB) {

  function RCB(err, succ) {
    if (_RCB) {
      _RCB(err, succ);
      _RCB = null;
    } else {
      console.error('why do second RCB ?', err, succ);
    }
  }

  connect.query(sql, function(query) {
    var data = flow.auto_data(limit);
    var line = -1;

    query.onMeta(function(meta) {
      var head = [];
      var type = [];

      meta.forEach(function(m) {
        head.push(m.field);
        type.push(m.typename);
      });

      data.setHead(head);
      data.setType(type);
    });

    if (limit > 0) {
      query.onData(function(row) {
        if (++line >= limit) {
          query.end();
          return;
        }
        try {
          data.push(row, line);
        } catch(err) {
          RCB(err);
        }
      });

    } else {

      query.onData(function(row) {
        try {
          data.push(row, ++line);
        } catch(err) {
          RCB(err);
        }
      });
    }

    query.onEnd(function() {
      RCB(null, data);
    });

    query.onErr(function(err) {
      RCB(err);
    });
  });
}


//
// 如果查询错误会发送系统事件,
// interactive   -- 与 core 交互
// connect       -- 数据库连接
// use_v2        -- true 使用更快的更新方式, 两个版本的回调函数的参数不同
//
function create_update_use_interactive(interactive, connect, use_v2) {
  var succ_count = 0;
  var fail_count = 0;
  var time = process.hrtime();
  var updater = use_v2 ? updater_v2 : updater_v1;

  //
  // sql  -- String 可以空
  // next -- Function(update_data) 完成后的回调, 不能空
  // update_data -- 更新相关信息
  // pack_size   -- 更新的数据量, 默认 1
  //
  function updater_v1(sql, next, size, _org_data) {
    if (sql) {
      update(sql, connect, function(err, data) {
        if (err) {
          fail_count += size || 1;
          // interactive.log(filter_java_exception(err), sql);
          // interactive.sendEvent(etype.UPDATE_FAIL, function() { next(data); });
          // interactive.bizlog('updatefail', _org_data);
          interactive.sendError(err, interactive.getData(), null, function() {
            next(data);
          });
        } else {
          succ_count += size || 1;
          next(data);
        }
      });
    } else {
      next();
    }
  }

  //
  // next -- Function() 完成后的回调, 不能空
  //
  function updater_v2(sql, next, size, _org_data) {
    if (sql) {
      connect.update(sql, function(err, arows) {
        if (err) {
          fail_count += size || 1;
          // interactive.log(filter_java_exception(err), sql);
          // interactive.bizlog('updatefail', _org_data.getData());
          // 必须最后调用发送事件, 事件的回调是同步的!
          // interactive.sendEvent(etype.UPDATE_FAIL, function() { next(); });
          interactive.sendError(err, interactive.getData(), null, function() {
            next();
          });
        } else {
          succ_count += size || 1;
          next();
        }
      });
    } else {
      next();
    }
  }

  //
  // 记录结果消息到日志, tname -- 目标名称
  //
  updater.log_count = function(total, tname) {
    var msg = (tname || '')
            + " 输出数据总计:" + total
            + ", 成功:" + succ_count
            + ", 失败:" + fail_count;

    interactive.sendEvent(etype.STATISTICS, {
      txt   : msg,
      total : total,
      succ  : succ_count,
      fail  : fail_count,
    });
    interactive.log(msg);
    console.log('!!!!!!!!!!!!!!!!', msg)

    if (total > 100) {
      logger.log(use_time(total));
    }
  }

  function use_time(total) {
    var diff = process.hrtime(time);
    var ms   = diff[0] * 1e3 + diff[1] / 1e6;
    var avg  = total / ms;
    var ret  = 'DB Update ' + total + ' rows, use ' + ms.toFixed(3)
             + ' ms, avg: ' + avg.toFixed(3) + ' Sql/ms';
    time = process.hrtime();
    return ret;
  }

  return updater;
}


//
// 执行一个 sql 返回原始数据
// limit 默认为 20
//
// _RCB: Function(err, data, meta)
// meta:
// data:
//
function update(sql, connect, _RCB, limit) {
  // console.log('QUERY:', sql);
  var r = 0;
  if (!limit) {
    limit = 20;
  }

  function RCB(err, data, meta) {
    _RCB && _RCB(err, data, meta);
    _RCB = null;
  }

  connect.query(sql, function(query) {
    var meta = null, data = [];

    query.onMeta(function(_meta) {
      meta = _meta;
    });

    query.onData(function(row) {
      if (++r > limit) {
        query.end();
      }
      data.push(row);
    });

    query.onEnd(function() {
      RCB(null, data, meta);
    });

    query.onErr(function(err) {
      RCB(err);
    });
  });
}


//
// RCB: Function(err, data)
// data: { meta:Object, data:Array }
//
function get_tables(configJSON, RCB) {
  check_conn(configJSON, function(connect) {
    var sql = select_table[ configJSON.conn.driver ];

    update(sql, connect, function(err, data, meta) {
      RCB(err, { meta:meta, data:data });
      connect.end();
    }, 999);
  }, RCB);
}


//
// RCB: Function(err, data)
// err : { retmessage:String }
// data: { retmessage:String, fields:Array }
//
function get_fields(configJSON, table, RCB) {
  check_conn(configJSON, function(connect) {
    connect.beginTran(function(err) {
      var sql = [];
      sql.push('select * from');
      sql.push(configJSON.table);
      sql.push('where 1>2');

      update(sql.join(SP), connect, function(err, data, meta) {
        connect.rollback(function() {
          connect.end();
        });

        if (err) {
          var msg = filter_java_exception(err);
          return RCB({'retmessage': '获取字段失败,' + msg});
        }

        RCB(null, {'retmessage': '成功', 'fields': meta});
      }, 999);

    });
  }, RCB);
}


//
// RCB: Function(err, data)
// err : { retmessage:String }
// data: { retmessage:String }
//
function check_table_mapping(conf, table, mapping, RCB) {
  check_conn(conf, function(connect) {
    connect.beginTran(function(err) {
      var sql = [];
      sql.push('select');

      for (var t in mapping) {
        sql.push( t );
        sql.push(',');
      }

      if (sql.length < 2) {
        return RCB({'retmessage': '必须配置字段映射'});
      }

      // 弹出末尾的逗号, 所以逗号要单独 push
      sql.pop();

      sql.push('from');
      sql.push(table);
      sql.push('where 1>2');

      update(sql.join(SP), connect, function(err, data, meta) {
        connect.rollback(function() {
          connect.end();
        });

        if (err) {
          var msg = filter_java_exception(err);
          return RCB({'retmessage': '表错误或映射无效, ' + msg});
        }

        RCB(null, {'retmessage': '成功'});
      });

    });
  }, RCB);
}
