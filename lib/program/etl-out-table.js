var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var db      = require('db3-lib');
var etype   = require('../type-event.js');
var dbtool  = require('../db-tool.js');
var tool    = require('../program-tool.js');


// 1000 条数据一个包, 最佳实践
var QUICK_BATCH_COUNT = 1000;
var NAME = 'etl-out-table';
var SP   = '';

var support_quick_insert = {
  mysql:1, oracle:1, sqlserver:1
};


module.exports = {
  name          : "数据库表输出",
  groupName     : "输出",
  programID     : "__" + NAME + "__",
  configPage    : NAME + '.htm',
  className     : 1,
  icon          : NAME + '.png',
  disable       : false,
  parent_max    : 1,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
};


//
// 运算器, 返回 a b 与运算符关系后的 sql
// a 是目标表字段, b 是值
//
var _operator = {
  // >
  1: function(a, b) {
    return a + " > '" + b + "' ";
  },
  // <
  2: function(a, b) {
    return a + " < '" + b + "' ";
  },
  // >=
  3: function(a, b) {
    return a + " >= '" + b + "' ";
  },
  // <=
  4: function(a, b) {
    return a + " <= '" + b + "' ";
  },
  // ==
  5: function(a, b) {
    return a + " = '" + b + "' ";
  },
  // like
  6: function(a, b) {
    return a + " LIKE '%" + b + "%' ";
  },
  // between
  7: function(a, b) {
    var bw = b.split(',');
    return a + " BETWEEN '" + bw[0] + "' AND '" + bw[1] + "' ";
  },
  // is null
  8: function(a, b) {
    return a + " IS NULL ";
  },
  // is not null
  9: function(a, b) {
    return a + " IS NOT NULL ";
  }
};


function createConfig(RCB) {
  var conf = {
    // 用于调用 checkConfig 时传参 'connonly'
    _type       : null,

    name        : '数据库表输出',
    table       : '',
    type        : '',

    field       : [], // 目标表字段
    comp        : [], // 比较方法
    cfield      : [], // 源表字段
    f_val       : [], // 比较值

    // 列映射关系
    mapping : {
      /* 'target_column_name' : 'src_column_name' */
    },
  };

  dbtool.init_db_config(conf);
  RCB(null, conf);
}


function checkConfig(cf, RCB) {
  var ch = dbtool.check_config(cf);
  var ret = ch.getResult();

  if (ret != null) return RCB(ret);

  tool.zip_arr(cf.field, cf.f_val, cf.cfield, cf.comp);

  if (cf._type == 'check_conn') {
    return dbtool.check_conn(cf, null, RCB);
  }

  if (cf._type == 'get_tables') {
    return dbtool.get_tables(cf, RCB);
  }

  if (cf._type == 'get_fields') {
    return dbtool.get_fields(cf, cf.table, RCB);
  }

  ch.mustStr('table');

  if (cf.type == 'i&u') {
    ch.mustArr('field', 1);
  }

  if (cf.type == 'qi') {
    if (!support_quick_insert[ cf.conn.driver ]) {
      RCB({ retmessage: cf.conn.driver + ' 不支持快速插入' })
      return;
    }
  }

  ret = ch.getResult();

  if (ret == null) {
    if (cf.type != 'del') {
      return dbtool.check_table_mapping(cf, cf.table, cf.mapping, RCB);
    }
  }

  RCB(ret);
}


function insert_or_update_sql(conf, data) {
  var update = update_sql(conf, data);
  var insert = insert_sql(conf, data);

  return function(sql, end) {
    update(sql, function(query_ret) {
      //
      // 执行更新, 如果成功无参返回, 否则执行插入
      //
      sql._update(sql.join(SP), function(query_ret) {
        if (query_ret && query_ret.affectedRows > 0) {
          end(sql);

        } else {

          sql.length = 0;
          insert(sql, function() {
            end(sql);
          });
        }

      });
    });
  };
}


function delete_sql(conf, data) {
  var lk = tool.call_link();

  lk.add(function(sql, next) {
    sql.push('DELETE FROM ');
    sql.push(conf.table);
    sql.push(' WHERE ');
    next();
  });

  make_where(lk, conf, data);

  return lk;
}


function insert_sql(conf, data, _not_head) {
  var lk = tool.call_link();
  var mapping = conf.mapping;
  var sqlhead = make_sql_head();

  //
  // quick_insert_sql() 依赖以下方法字符串的生成, 需要同步修改
  //
  function make_sql_head() {
    var sql = [];
    sql.push('INSERT INTO ');
    sql.push(conf.table);
    sql.push('(');

    for (var tname in mapping) {
      sql.push( tname );
      sql.push(', ');
    }
    sql.pop();
    sql.push(') VALUES ( ');
    return sql.join(SP);
  }

  if (_not_head) {
    lk.header = sqlhead;
  } else {
    lk.add(function(sql, next) {
      sql.push(sqlhead);
      next();
    });
  }

  for (var tname in mapping) {
  (function() {

    var i = data.getColumn(mapping[tname]);

    lk.add(function(sql, next) {
      sql.push("'");
      sql.push(sql._data[i]);
      sql.push("'");
      sql.push(', ');
      next();
    });
  })();
  }

  lk.add(function(sql, next) {
    // 弹出末尾的逗号, 所以逗号要单独 push
    sql.pop();
    sql.push(' )');
    next();
  });

  return lk;
}


function quick_insert_sql(conf, data) {
  var fnlink   = insert_sql(conf, data, true);
  var header   = fnlink.header;
  var count    = 0;
  var null_arr = { join: function() { return null; } };
  var ret;
  var sp_sub_str;
  var batch_sql;

  var quick_fn = {
    'mysql'    : _mysql_sql,
    'oracle'   : _oracle_sql,
    'sqlserver': _sqlserver_sql
  };

  var gsqlfn = quick_fn[ conf.conn.driver ];
  if (!gsqlfn) {
    throw new TypeError('数据库类型, 不支持快速插入');
  }

  gsqlfn();
  new_batch();

  return ret;


  function _oracle_sql() {
    fnlink = _create_link(true);
    sp_sub_str = ' union all ';
    _template_sql();
  }

  function _mysql_sql() {
    sp_sub_str = ", \n ( ";
    _template_sql();
  }

  function _sqlserver_sql() {
    fnlink = _create_link(false);
    sp_sub_str = ' union all ';
    _template_sql();
  }

  function _create_link(_is_oracle) {
    var i = header.indexOf('VALUES');
    header = header.substring(0, i);
    var lk = tool.call_link();

    lk.add(function(sql, next) {
      sql.push('select ');
      next();
    });

    for (var tname in conf.mapping) {
      (function() {

        var i = data.getColumn(conf.mapping[tname]);

        lk.add(function(sql, next) {
          sql.push("'");
          sql.push(sql._data[i]);
          sql.push("'");
          sql.push(', ');
          next();
        });
      })();
    }

    if (_is_oracle) {
      lk.add(function(sql, next) {
        sql.pop();
        sql.push(' from dual ');
        next();
      });
    } else {
      lk.add(function(sql, next) {
        sql.pop();
        next();
      });
    }

    return lk;
  }

  function _template_sql() {
    ret = function(sql, end) {
      batch_sql._data = sql._data;

      fnlink(batch_sql, function() {
        if ( ++count >= QUICK_BATCH_COUNT || data.has() != true ) {
          var _dsql = batch_sql.join('');
          var _size = count;
          new_batch();
          // console.log(_dsql)
          end({ join: function() { return _dsql; }, p_size: _size });
        } else {
          batch_sql.push(sp_sub_str);
          end(null_arr);
        }
      });
    };
  }

  function new_batch() {
    batch_sql = [];
    batch_sql.push(header);
    count = 0;
  }
}


function update_sql(conf, data) {
  var lk = tool.call_link();
  var mapping = conf.mapping;
  var sqlhead = make_sql_head();


  function make_sql_head() {
    var sql = [];
    sql.push('UPDATE ');
    sql.push(conf.table);
    sql.push(' SET ');
    return sql.join(SP);
  }

  lk.add(function(sql, next) {
    sql.push(sqlhead);
    next();
  });

  for (var tname in mapping) {
  (function() {

    var fname = tname;
    var i = data.getColumn(mapping[fname]);

    lk.add(function(sql, next) {
      sql.push(fname);
      sql.push(" = '");
      sql.push(sql._data[i]);
      sql.push("'");
      sql.push(', ');
      next();
    });
  })();
  }

  lk.add(function(sql, next) {
    sql.pop();
    sql.push(' WHERE ');
    next();
  });

  make_where(lk, conf, data);

  return lk;
}


//
// 不生成 WHERE 关键字
//
function make_where(cl, conf, data) {

  cl.add(function(sql, next) {
    sql.push("1=1");
    next();
  });

  conf.field.forEach(function(tagname, i) {
    var op = _operator[ conf.comp[i] ];
    var b  = conf.f_val[i];

    if (b) {
      var buf = op(tagname, b);

      cl.add(function(sql, next) {
        sql.push(" AND ");
        sql.push(buf);
        next();
      });
    } else {
      var si = data.getColumn(conf.cfield[i]);

      cl.add(function(sql, next) {
        sql.push(" AND ");
        sql.push( op(tagname, sql._data[si]) );
        next();
      });
    }
  });
}


function run(interactive, limit) {

  var root = interactive.getConfig();
  var conf = root.run_config;
  var data = interactive.getData();

  var running    = true;
  var sqlbuilder = null;


  switch(conf.type) {
    case 'del':
      sqlbuilder = delete_sql(conf, data);
      break;

    case 'ins':
      sqlbuilder = insert_sql(conf, data);
      break;

    case 'upd':
      sqlbuilder = update_sql(conf, data);
      break;

    case 'i&u':
      sqlbuilder = insert_or_update_sql(conf, data);
      break;

    case 'qi':
      sqlbuilder = quick_insert_sql(conf, data);
      break;

    default:
      interactive.sendEvent(etype.ERROR, "无效操作类型:" + conf.type);
      return;
  }


  dbtool.check_conn(conf, function(connect) {

    interactive.sendEvent(etype.BEGIN_UPDATE, connect);

    interactive.onStop(function() {
      running = false;
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

      var sql = [];
      data.next();
      // 在 sql 上绑定...东西?!
      sql._data = data.getData();
      sql._update = updater;

      //
      // 返回的 _sql 可以是不同与 sql 的对象
      // 利用 p_size (可以空, 默认1) 属性传递更新数量
      //
      sqlbuilder(sql, function(_sql) {
        running && updater(_sql.join(SP), _do_loop, _sql.p_size, data);
        // _do_loop(); // !!!!!!! 测试用
      });
    }

  }, function(err) {
    if (err) interactive.sendEvent(
      etype.ERROR, dbtool.filter_java_exception(err));
  });
}
