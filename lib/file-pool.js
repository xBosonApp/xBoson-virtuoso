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
var fs     = require('fs');
var path   = require('path');
var tool   = require('./program-tool.js');
var uuid   = require('uuid-zy-lib');
var qs     = require('querystring');
var syscnf = require('configuration-lib').load();

var base        = path.join(syscnf.eeb_zy.local_db_dir, 'file_pool');
var default_dir = '$all';
var fix_dir     = '$fix';


//
// 文件池中间件
//
module.exports = {
  get     : get,
  upload  : upload,
  list    : list,
  del     : del,

  base    : base,
  def     : default_dir,
  fix     : fix_dir
};

var ext_names = {
  '.csv' : true
};


// fp_get
function get(req, resp, errorHand, success) {
  var tname    = req.query.tname; // 下载文件名, 可以空
  var filename = req.query.fname; // 真实文件名
  var fix = Number(req.query.fix);

  if (check_fname(filename, errorHand)) {
    return;
  }

  if (fix == 1) {
    _get_file(fix_dir);
  } else {
    get_user_id(req, _get_file);
  }

  function _get_file(_dir) {
    var enc_fname = qs.escape(tname || filename);

    resp.set('Content-type', 'application/file');
    resp.set('Content-Disposition', 'attachment; filename=' + enc_fname);

    var targetfile = path.join(base, _dir, filename);
    var reader = fs.createReadStream(targetfile);

    reader.on('error', errorHand);
    reader.pipe(resp);
  }
}


// fp_del
function del(req, resp, errorHand, success) {
  var filename = req.query.fname;

  if (check_fname(filename, errorHand)) {
    return;
  }

  get_user_id(req, function(uid) {
    var targetfile = path.join(base, uid, filename);

    if (!fs.existsSync(targetfile)) {
      return errorHand(new Error('错误: 文件不存在'));
    }

    fs.unlink(targetfile, function(err) {
      if (err) {
        errorHand(new Error('错误: ' + err.message));
      } else {
        success('文件已经删除 ' + filename);
      }
    });
  });
}


// fp_up
function upload(req, resp, errorHand, success) {
  var filename = req.query.fname;
  var replace  = req.query.rep;
  var extname  = path.extname(filename);

  if (check_fname(filename, errorHand)) {
    return;
  }

  if ((!extname) || ext_names[ extname.toLowerCase() ] == null) {
    errorHand(new Error('错误: 不支持的文件类型'));
    return;
  }


  get_user_id(req, function(uid) {
    var basen      = path.basename(filename, extname);
    var targetfile = path.join(base, uid, basen);
    var suffix     = '';
    var rcount     = 0;

    if (!replace) {
      while (fs.existsSync(targetfile + suffix + extname)) {
        suffix = '-' + (++rcount);
      }
    }

    targetfile = targetfile + suffix + extname;


    fs.open(targetfile, 'w', function(err, fd) {
      if (err) errorHand(err);

      req.on('data', function(buffer) {
        fs.write(fd, buffer, 0, buffer.length, null, function(err) {
          if (err) errorHand(err);
        });
      });

      req.on('end', function() {
        var msg = filename;

        if (replace) {
          msg += ', 文件替换成功';
        } else {
          msg += ', 文件上传成功';
        }

        if (rcount > 0) {
          msg += ', 重命名为 ' + basen + suffix + extname;
        }

        success(msg);
        fs.closeSync(fd);
      });

      req.on('error', errorHand);
    });
  });
}


// fp_list
function list(req, resp, errorHand, success) {
  get_user_id(req, function(uid) {
    
    var fpath = path.join(base, uid);

    fs.readdir(fpath, function(err, files) {
      if (err) errorHand(err);
      var ret = [];

      files.forEach(function(f, i) {
        var truepath = path.join(fpath, f);
        var stat = fs.statSync(truepath);

        ret.push({
          f  : f,
          mt : stat.mtime,
          tf : truepath
        });
      });

      success(ret);
    });
  });
}


function check_fname(fname, errorHand) {
  if (!fname) {
    errorHand(new Error('确实参数'));
    return true;
  }

  if (fname.indexOf('..') >= 0) {
    errorHand(new Error('非法的文件名'));
    return true;
  }
}


function get_user_id(req, user_id_getter) {

  if (!req.query.openid) {
    return user_id_getter(default_dir);
  }

  // req 需要有 openid, org
  req.query.api = 'getuserinfo';
  req.query.mod = 'ZYMODULE_LOGIN';
  req.query.app = 'ZYAPP_LOGIN';


  tool.zy(req, null, function(dat) {

    var ret = JSON.parse(dat), 
        uid = default_dir;

    if (ret.ret == 0) {
      uid = ret.result[0].userid;
    }

    user_id_getter(uid);

  }, function() {
    user_id_getter(default_dir);
  })
}