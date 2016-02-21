var fs     = require('fs');
var path   = require('path');
var uuid   = require('uuid-zy-lib');
var logger = require('logger-lib')('eeb');
var syscnf = require('configuration-lib').load();
var TMAP   = require('./type-eeb.js');

var MAX_LOG_SIZE  = 50 * 1024;
var BASE_PATH     = syscnf.eeb_zy.local_db_dir;

var eeb_conf_dir  = path.join(BASE_PATH, 'eeb_config');
var statistics    = path.join(BASE_PATH, 'statistics');
var detail_log    = path.join(BASE_PATH, 'details');


//
// 本地文件数据库, 用于保存配置, 记录执行日志
//
module.exports = {
  TMAP    : TMAP,
  getlist : getlist,
  saverc  : saverc,
  rename  : rename,
  delrc   : delrc,
  getrc   : getrc,

  log     : log,
  sta     : sta,
  getlog  : getlog,

  init_detail_log : create_detail_log_dir
};

var _writer_cache = {};
var _open_cache = {};

//----------------------------------------------------------------------------
//                                               操作详细日志 * 切换到数据库
//----------------------------------------------------------------------------

//
// 写入日志消息
// key -- 日志分类key
// rc  -- 配置信息, 从中取数据
// his -- 历史记录对象
//
function log(key, rc, his) {
  open_write_file(key, detail_log, function(err, ws, next) {
    if (err) {
      console.error(err);
      return;
    }

    // 时间, 作业名, 程序名, 目标名, 消息, 数据
    create_row(ws, 0, [ Date(his.time),
        rc.name, his.pname, his.tname, his.msg, his.data ], next);
  });
}


//
// 写出的行附加属性 <tr tkey=''> 
//
function create_row(ws, tr_key, arr, _write_over) {
  ws.write('<tr tkey="');
  ws.write(String(tr_key));
  ws.write('">');

  for (var i=0; i<arr.length; ++i) {
    ws.write('<td>');
    arr[i] && ws.write(String(arr[i]));
    ws.write('</td>');
  }

  ws.write('</tr>', _write_over);
}


//
// writer 不要调用 end(), 完成后调用 next()
// rcb: Function(err, writer, next)
//
function open_write_file(rid, dir, rcb) {

  open_log_file(rid, dir, function(err, fname) {
    if (err) return rcb(err);

    // 使用缓存队列解决异步写入顺序混乱的问题
    var fcache = _writer_cache[fname];
    if (fcache) {
      fcache.nextfn.push(function() {
        rcb(null, fcache.writer, _end);
      }); 
      return;
    }

    var writer = fs.createWriteStream(fname, { encoding: 'UTF8', flags: 'a' });

    fcache = _writer_cache[fname] = { 
      writer   : writer,
      nextfn   : []
    };

    rcb(null, writer, _end);

    function _end() {
      var next_log_fn = fcache.nextfn.shift();
      if (next_log_fn) {
        next_log_fn();
      } else {
        fcache.writer.end();
        delete _writer_cache[fname];
      }
    }
  });
}


//
// rcb : Function(err, filename)
//
function open_log_file(rid, dir, rcb) {
  var okey = path.join(dir, rid);
  var i = _open_cache[okey] || 1;
  var _file = null;

  if (_open_cache[okey]) {
    _file = path.join(dir, rid, String(i));
    rcb(null, _file);
    check_size(save);
  } else {
    check_file(open);
  }

  function open() {
    save();
    rcb(null, _file);
  }

  function save() {
    _open_cache[okey] = i;
  }

  function check_file(next) {
    _file = path.join(dir, rid, String(i));

    var _ext = fs.existsSync(_file);
    if (!_ext) {
      return next();
    }
      
    check_size(next);
  }

  function check_size(next) {
    fs.stat(_file, function(err, st) {
      if (err) return rcb(err);
      if (st.size > MAX_LOG_SIZE) {
        ++i;
        return check_file(next);
      }
      next();
    });
  }
}


function create_log_dir(dir, key) {
  // _c(statistics);
  // _c(detail_log);

  dir = path.join(dir, key);

  // fs.exists(dir, function(_ext) {
  //   if (!_ext) {
  //     fs.mkdir(dir);
  //   }
  // });

  try {
    fs.mkdirSync(dir);
  } catch(err) {
    /* do nothing */
  }
}


function create_detail_log_dir(key) {
  create_log_dir(detail_log, key);
}

//----------------------------------------------------------------------------
//                                               操作概览日志 * 切换到数据库
//----------------------------------------------------------------------------

//
// 写入概览日志
// tbegin  -- 开始时间, 毫秒值
// tend    -- 结束时间, 毫秒值
// rc      -- 作业配置
// msg_arr -- 消息内容数组, 一条消息是一个元素
//
function sta(key, tbegin, tend, rc, msg_arr) {
  open_write_file(rc.rid, statistics, function(err, ws, next) {
    if (err) {
      console.error(err);
      return;
    }
    
    // 开始时间, 结束时间, 作业名称, 消息
    create_row(ws, key, [ Date(tbegin), 
        Date(tend), rc.name, msg_arr.join('; ') ], next);
  });
}


//
// rcb     -- Function(err, reader)
// logtype -- 1:detail, 2:statistics
//
function getlog(_key, logtype, page, page_size, rcb) {
  var dir = (logtype == 1) ? detail_log : statistics;
  var filename = path.join(dir, _key, page);

  fs.exists(filename, function(_ext) {
    if (_ext) {
      fs.readdir(path.join(dir, _key), function(err, files) {
        if (err) return rcb(err);

        var html = fs.readFileSync(filename, { encoding: 'UTF8' });
        rcb(null, {
          html  : html,
          cpage : files.length
        });
      });
    } else {
      rcb(new Error('尚未运行, 没有作业历史'));
    }
  });
}


//----------------------------------------------------------------------------
//                                                              操作配置文件
//----------------------------------------------------------------------------

//
// 读取一个配置文件
//
function loadLocalData(rid, type_num, cb, no_file_no_err) {
  var file = path.join(eeb_conf_dir, TMAP[type_num], rid);

  fs.readFile(file, {encoding:'utf8'}, function(err, data) {
    if (err) {
      if (no_file_no_err) return cb();
      return cb(err);
    }
    try {
      var ret = JSON.parse(data);
      cb(null, ret);
    } catch(perr) {
      cb(perr);
    }
  });
}


function warpcb(errorcb, successcb) {
  return function(err, data) {
    if (err) {
      errorcb(err);
    } else {
      successcb(data);
    }
  }
}


// ETL:1, ESB:2, BPM:4
function getlist(type, cb) {
  var dir = path.join(eeb_conf_dir, TMAP[type]);
  var files = null;
  var i = -1;
  var all_conf = {};

  fs.readdir(dir, function(err, _files) {
    if (err) return cb(err);
    files = _files;
    if (_files && _files.length > 0) {
      loadfiles();
    } else {
      cb(new Error('没有作业可读取'));
    }
  });

  function loadfiles() {
    if (++i >= files.length) {
      toArray(all_conf);
      return;
    }

    loadLocalData(files[i], type, function(err, data) {
      if (err) return cb(err);
      all_conf[data.rid] = data;
      loadfiles();
    });
  }

  function toArray(arr) {
    var ret = [];

    for (var n in arr) {
      var v = arr[n];
      ret.push({
        name      : v.name,
        rid       : v.rid,
        clusterid : v.clusterid,
        type      : v.className,
      });
    }
    cb(null, ret);
  }
}


// 对保存/读取进行一次性封装
function configrc(cb, rid, type, _do_handle) {
  loadLocalData(rid, type, warpcb(cb, function(data) {
    if (!type) return cb(new Error('type must define.'));

    if (!data) data = {};

    if (_do_handle(data) != true) {
      var fp = path.join(eeb_conf_dir, TMAP[type], rid);

      fs.writeFile(fp, JSON.stringify(data), function(err) {
        if (err) cb(err);
        cb(null, '成功');
      });
    }
  }), true);
}


function saverc(rc, cb) {
  configrc(cb, rc.rid, rc.className, function(data) {

    if (data[rc.rid]) {
      logger.log('config replease', rc.rid);
    }

    for (var n in data) {
      delete data[n];
    }

    for (var n in rc) {
      data[n] = rc[n];
    }

    // 不再使用文件记录日志
    // create_log_dir(statistics, rc.rid);
  });
}


function getrc(rid, type, cb) {
  loadLocalData(rid, type, warpcb(cb, function(data) {
    if (!type) return cb(new Error('type must define.'));
    // var data = localdata[TMAP[type]][rid];
    if (!data) return cb(new Error('cannot find config ' + rid));
    cb(null, data);
  }));
}


function delrc(rid, type, cb) {
  loadLocalData(rid, type, warpcb(cb, function(data) {
    if (data.rid != rid) {
      cb(new Error('找不到对应的配置 ' + rid));
      return;
    }

    var fp = path.join(eeb_conf_dir, TMAP[type], rid);
    fs.unlink(fp, function(err) {
      console.log(err)
      if (err) return cb(err);
      cb(null, '作业已删除');
    });
  }));
}


function rename(rid, cid, name, type, cb) {
  configrc(cb, rid, type, function(data) {
    if (data.rid != rid) {
      cb(new Error('找不到对应的配置 ' + rid));
      return true;
    }

    data.name = name;
    data.clusterid = cid;
  });
}