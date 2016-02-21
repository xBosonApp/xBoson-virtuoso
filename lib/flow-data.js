var logger = require('logger-lib')('eeb');
var util   = require('util');
var uuid   = require('uuid-zy-lib');
var fs     = require('fs');
var path   = require('path');
var sort   = require('./j-quicksort.js').sort;
var tool   = require('./program-tool.js');
var cnflib = require('configuration-lib');
var syscnf = cnflib.load();


module.exports = {
  mem_data  : mem_data,
  file_data : file_data,
  auto_data : auto_data,

  TYPE : {
    ETL : 'etl_data',
    ESB : 'esb_data',
    BPM : 'bpm_notsupport',
  }
};


var ORG_LINE_ATTR     = 'line';
var HOW_ROW_USE_FILE  = 20000;
var file_pool         = [];
var TYPE              = module.exports.TYPE;


//
// limit -- 这个参数废弃, 不再有效
// className -- 1/2/4 必须是以上值, 不能是混合值, 默认 1
//
function auto_data(limit, className) {
  // file_data.toString() 是不返回数据的, 测试时会看不到数据

  // if (limit > HOW_ROW_USE_FILE) {
  //   return file_data();
  // }

  switch (parseInt(className)) {
    default:
    case 1:
      return mem_data();

    case 2:
      return esb_data();
    
    case 4:
      throw new Error('cannot support');
  }

  console.log('flow-data.js, cannot create flow', className);
}


function esb_data() {
  var fd   = {
    className : TYPE.ESB,

    getHead   : getHead,
    getType   : getType,
    getData   : getData,
    getField  : _cs,
    getColumn : _cs,
    toString  : toString,
    isempty   : isempty,
    moveto    : _cs,
    clone     : clone,
    totalrows : _cs,

    reset     : reset,
    setHead   : setHead,
    setType   : setType,
    push      : push,
    next      : _cs,
    has       : has,

    __from_original : __from_original
  };

  var head = null;
  var type = null;
  var data = null;

  function getHead() {
    return head;
  }

  function getType() {
    return type;
  }

  function getData() {
    return data;
  }

  function push(_d) {
    if (!_d) {
      throw new Error('push arg must not null')
    }
    data = _d;
  }

  function toString(obj) {
    return JSON.stringify({
      className : fd.className,
      head : { /* 私有数据不应该输出 */ },
      type : getType(),
      data : getData(),
      ext  : obj
    });
  }

  function __from_original(_original) {
    reset();
    setHead(_original.head);
    setType(_original.type);
    data = (_original.data);
  }

  function isempty() {
    return !head;
  }

  function _cs() {
    throw new Error('cannot support');
  }

  function clone(target) {
    if (!target) {
      target = esb_data();
    }
    target.setHead( getHead() );
    target.setType( getType() );
    return target;
  }

  function reset() {
    head = type = data = null;
  }

  function setHead(h) {
    if (head) throw new Error("must reset");
    head = light_copy(h);
  }

  function setType(t) {
    if (type) throw new Error("must reset");
    type = light_copy(t);
  }

  function has() {
    return !(!data);
  }

  return fd;
}


function mem_data() {
  var fd   = {
    className : TYPE.ETL,

    getHead   : getHead,
    getType   : getType,
    getData   : getData,
    getField  : getField,
    getColumn : getColumn,
    toString  : toString,
    isempty   : isempty,
    moveto    : moveto,
    clone     : clone,
    totalrows : totalrows,

    reset     : reset,
    setHead   : setHead,
    setType   : setType,
    push      : push,
    next      : next,
    has       : has,

    // 使用 toString() 的数据格式初始化, 只允许内核调用 !
    __from_original : __from_original,
    __get_col_name_index : __get_col_name_index,
    __head_ok : null
  };

  var head    = null;
  var type    = null;
  var col     = null;
  var row     = 0;
  var cursor  = -1;
  var hindex  = null;
  var orgline = null;


  function isempty() {
    return head == null;
  }

  function totalrows() {
    return row;
  }

  function clone(c) {
    if (!c) {
      c = mem_data();
    }
    c.setHead(getHead());
    c.setType(getType());
    return c;
  }

  function getHead() {
    // slice(0) 可以复制数组
    return head.slice(0);
  }

  function getType() {
    if (type) {
      return type && type.slice(0);
    } else {
      var tmp = [];
      tmp.length = head.length;
      return tmp;
    }
  }

  function __get_col_name_index() {
    return hindex;
  }

  function getData() {
    var data = [];
    for (var i = head.length - 1; i >= 0; --i) {
      data[i] = col[i][cursor];
    }
    data[ORG_LINE_ATTR] = orgline[cursor];
    return data;
  }

  function getField(headname) {
    if (isNaN(headname)) {
      return col[ hindex[headname] ][cursor];
    } else {
      return col[ headname ][cursor];
    }
  }

  function getColumn(headname) {
    return hindex[headname];
  }

  function moveto(rowi) {
    cursor = rowi - 1;
  }

  function reset() {
    col = head = type = orgline = null;
    row = 0; cursor = -1;
  }

  function setHead(_h) {
    if (head) throw new Error("must reset");

    head   = _h.slice(0);
    hindex = {};

    for (var i = head.length-1; i >= 0; --i) {
      if (hindex[head[i]]) {
        var nn = head[i];
        reset();
        throw new Error("Head 名称冲突: " + nn);
      }
      hindex[head[i]] = i;
    }
    createCol();

    if (typeof fd.__head_ok == 'function') {
      fd.__head_ok();
    }
  }

  function setType(_t) {
    if (type) throw new Error("must reset");

    if (_t) {
      type = _t.slice(0);
      if (type.length != head.length) {
        throw new Error("head.length 必须与 type.length 相同");
      }
    }
  }

  function createCol() {
    orgline = [];
    col = [];
    for (var i = head.length-1; i >= 0; --i) {
      col.push([]);
    }
  }

  function push(_d, _org_line_num) {
    if (!_d) {
      throw new Error('push arg must not null')
    }

    if (util.isArray(_d)) {
      for (var i = col.length-1; i >= 0; --i) {
        col[i].push(_d[i]);
      }
    } else {
      for (var i = col.length-1; i >= 0; --i) {
        col[i].push(_d[ head[i] ]);
      }
    }

    orgline[row] = _d[ORG_LINE_ATTR] || _org_line_num || 0;

    if (++row > HOW_ROW_USE_FILE) {
      __switch_use_file_data();
    }
  }

  // 如果有更多数据则返回 true, 之后可以调用 next()
  function has() {
    // console.log('has1', cursor, row);
    return cursor+1 < row;
  }

  // 使迭代器进入下一行
  function next() {
    // console.log('next1', cursor, row);
    ++cursor;
  }

  function toString(obj) {
    return JSON.stringify({
      className : fd.className,
      head : getHead(),
      type : getType(),
      data : col,
      ext  : obj
    });
  }

  function __from_original(_original) {
    reset();
    setHead(_original.head);
    setType(_original.type);
    col = _original.data;
    row = col[0].length;
  }

  //
  // 数据量过大, 则切换到文件中保存数据
  //
  function __switch_use_file_data() {
    // console.log('switch to file');

    var _fd = file_data();
    _fd.setHead(head);
    _fd.setType(type);

    var cur = cursor;
    moveto(0);

    while (has()) {
      next();
      _fd.push(getData());
    }

    reset();
    _fd.moveto(cur+1);

    for (var attr in _fd) {
      fd[attr] = _fd[attr];
    }
  }

  return fd;
}


//
// 1千万长度数组, 300MB内存
//
function file_data() {
  var fd = mem_data();

  var basepath = path.join(syscnf.eeb_zy.local_db_dir, 'flow_data');
  var idx_len  = 8;

  var filename = null;
  var idx_name = null;
  var dat_name = null;

  var idx_file = null;
  var dat_file = null;

  var mreset   = fd.reset;
  var cursor   = -1;
  var row      = 0;
  var head     = null;
  var hindex   = null;
  var colc     = 0;
  var idx_off  = 0;
  var r_cache  = null;
  var q_cache  = null;
  var LINE_COL = -1;
  var HIDE_COL = -1;


  fd.__head_ok = _init;
  fd.push      = push;
  fd.getData   = getData;
  fd.getField  = getField;
  fd.reset     = reset;
  fd.has       = has;
  fd.moveto    = moveto;
  fd.next      = next;
  fd.totalrows = totalrows;


  function _init() {
    filename = path.join(basepath, uuid.v1());
    idx_name = filename + '.idx';
    dat_name = filename + '.dat';

    idx_file = fs.openSync(idx_name, 'w+');
    dat_file = fs.openSync(dat_name, 'w+');

    head     = fd.getHead();
    hindex   = fd.__get_col_name_index();
    colc     = head.length;
    r_cache  = _not_cache;
    q_cache  = tool.quick_cache();
    LINE_COL = colc;
    HIDE_COL = colc+1;

    file_pool.push(idx_name);
    file_pool.push(dat_name);
  }

  function reset() {
    mreset();
    q_cache.clear();
    q_cache.info();

    cursor = LINE_COL = HIDE_COL = -1;
    row = colc = idx_off = 0;
    head = hindex = r_cache = q_cache = null;

    dat_name && fs.unlink(dat_name);
    idx_name && fs.unlink(idx_name);

    dat_name = idx_name = null;
  }

  function _not_cache() {
    throw new Error('must call next() and getData()');
  }

  function push(_d, _org_line_num) {
    if (!_d) {
      throw new Error('push arg must not null')
    }

    if (util.isArray(_d)) {
      for (var i = 0; i< colc; ++i) {
        _push(_d[i], i);
      }
    } else {
      for (var i = 0; i< colc; ++i) {
        _push(_d[ head[i] ], i);
      }
    }

    _push(_d[ORG_LINE_ATTR] || _org_line_num || 0, LINE_COL);

    ++row;
    // console.log('psuh2', _d, row);
  }

  //
  // push 的速度足够快, 不需要优化
  // colc + 1 作为隐藏列
  //
  function _push(str, col) {
    // 此处没有做数据转换
    var dat = new Buffer(String(str), 'utf8');
    var idx = new Buffer(idx_len);

    var idx_pos = row * idx_len * HIDE_COL + col * idx_len;

    // console.log('w', idx_off, dat.length, row, col, idx_pos);

    // 0-4 开始位置
    idx.writeUInt32BE(idx_off, 0);
    // 4-8 长度
    idx.writeUInt32BE(dat.length, 4);

    fs.writeSync(dat_file, dat, 0, dat.length, idx_off);
    fs.writeSync(idx_file, idx, 0, idx.length, idx_pos);

    idx_off += dat.length;
  }

  // 当移动光标时, 缓存当前行的数据
  function _read_curr_row_to_cache() {

    if (cursor < 0 || cursor >= row) {
      r_cache = _not_cache;
      return;
    }

    var idx = null, 
        dat = null, 
        begin_at = null,
        _d_cache = q_cache.get(cursor);


    if (_d_cache) {

      idx       = _d_cache.idx;
      dat       = _d_cache.dat;
      begin_at  = _d_cache.begin_at;

    } else {
      // 如果这里读取多行数据, 速度还能提升

      var rlen     = HIDE_COL * idx_len;
      idx          = new Buffer(rlen);
      fs.readSync(idx_file, idx, 0, rlen, cursor * rlen);

      begin_at     = idx.readUInt32BE(0);
      var end_at   = idx.readUInt32BE(rlen - idx_len);
      var last_len = idx.readUInt32BE(rlen - idx_len + 4);
      var dat_len  = end_at - begin_at + last_len;
      dat          = new Buffer(dat_len);
      fs.readSync(dat_file, dat, 0, dat_len, begin_at);

      q_cache.save(cursor, {
        dat      : dat,
        idx      : idx,
        begin_at : begin_at
      });
    }
  
    //
    // 返回列的数据 Function(column_index)
    //
    r_cache = function(col) {
      var a = idx.readUInt32BE(col * idx_len) - begin_at;
      var b = idx.readUInt32BE(col * idx_len + 4) + a;
      // console.log('???', a, b);
      return String( dat.slice(a, b) );
    }
  }

  function getData() {
    var ret = [];
    for (var i = 0; i< colc; ++i) {
      ret[i] = r_cache(i);
    }
    ret[ORG_LINE_ATTR] = Number( r_cache(LINE_COL) );
    return ret;
  }

  function getField(headname) {
    if (isNaN(headname)) {
      return r_cache( hindex[headname] );
    } else {
      return r_cache( headname );
    }
  }

  function has() {
    // console.log('has2', cursor, row);
    return cursor+1 < row;
  }

  function moveto(r) {
    // console.log('moveto', cursor, r, row);
    cursor = r-1;
  }

  // 使迭代器进入下一行
  function next() {
    ++cursor;
    _read_curr_row_to_cache();
  }

  function totalrows() {
    return row;
  }

  return fd;
}


function light_copy(obj) {
  var ret = {};
  for (var n in obj) {
    ret[n] = obj[n];
  }
  return ret;
}


process.on('exit', function(code) {
  delete_all_files();
});


function delete_all_files() {
  file_pool.forEach(function(file) {
    try {
      fs.unlinkSync(file);
    } catch(err) {
      /* 删除失败也没关系 */
    }
  });

  console.log("& Release flow data file: \n\t", 
              file_pool.join('\n\t ') );

  file_pool.length = 0;
}