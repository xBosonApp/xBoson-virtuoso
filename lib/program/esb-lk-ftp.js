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
﻿var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var dbtool  = require('../db-tool.js');
var format  = require('string-format');


var __NAME  = 'esb-lk-ftp';


var pg_cnf = module.exports = {
  name          : "FTP 客户端",
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


var ftp_codes = {
  '110': '重新启动标记应答',
  '120': '服务在多久时间内ready',
  '125': '数据链路埠开启，准备传送',
  '150': '文件状态正常，开启数据连接端口',
  '200': '命令执行成功',
  '202': '命令执行失败',
  '211': '系统状态或是系统求助响应',
  '212': '目录的状态',
  '213': '文件的状态',
  '214': '求助的讯息',
  '215': '名称系统类型',
  '220': '新的联机服务ready',
  '221': '服务的控制连接埠关闭，可以注销',
  '225': '数据连结开启，但无传输动作',
  '226': '关闭数据连接端口，请求的文件操作成功',
  '227': '进入passive mode',
  '230': '使用者登入',
  '250': '请求的文件操作完成',
  '257': '显示目前的路径名称',
  '331': '用户名称正确，需要密码',
  '332': '登入时需要账号信息',
  '350': '请求的操作需要进一部的命令',
  '421': '无法提供服务，关闭控制连结',
  '425': '无法开启数据链路',
  '426': '关闭联机，终止传输',
  '450': '请求的操作未执行',
  '451': '命令终止：有本地的错误',
  '452': '未执行命令：磁盘空间不足',
  '500': '格式错误，无法识别命令',
  '501': '参数语法错误',
  '502': '命令执行失败',
  '503': '命令顺序错误',
  '504': '命令所接的参数不正确',
  '530': '未登入或登录失败',
  '532': '储存文件需要账户登入',
  '550': '未执行请求的操作',
  '551': '请求的命令终止，类型未知',
  '552': '请求的文件终止，储存位溢出',
  '553': '未执行请求的的命令，名称不正确',
  'ECONNREFUSED' : '连接被拒绝',
  'ENOTFOUND'    : '找不到主机',
}


function createConfig(RCB) {
  var conf = {
    _type       : null,
    name        : pg_cnf.name,
    out         : '',
    in          : '',
    cdir        : '/',      // 当前目录, 用于列举目录用

    host        : 'localhost',
    port        : 21,
    user        : 'anonymous',
    password    : 'anonymous@', 
    timeout     : '15',     // 秒

    // 操作模式: get: 下载, put: 上传, append: 附加到文件末尾
    // delete: 删除文件, rename: 重命名, list: 列出目录
    mode        : 'get', 
    file        : '',       // 目标文件的完整目录
    transport   : 'ascii',  // ascii / binary
    newname     : '',
  };

  RCB(null, conf);
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustStr('host', 1);
  ch.mustNum('port', 1, 65535);
  ch.mustNum('timeout', 1, 999);
  ch.mustStr('mode', 1);


  if (ch.noError() && cf._type == 'list') {
    connftp(function(conn, end) {
      conn.list(cf.cdir, function(err, list) {
        if (err) {
          ch.push('retmessage', ftp_msg(err));
          return end();
        }

        // 为什么 找不到文件不是错误 ??
        var haserr = false;
        list.forEach(function(f) {
          if (!f.name) haserr = true;
        });
        if (haserr) {
          ch.push('retmessage', list[0]);
          return end();
        }

        end(list);
      });
    });
    return;
  }


  if (ch.noError() && cf._type == 'check_conn') {
    connftp(function(conn, end) {
      end();
    });
    return;
  }


  switch (cf.mode) { // some not break!
    case 'rename':
      ch.mustStr('newname');
      ch.mustStr('file');
      break;

    case 'append':
    case 'put':
      ch.mustStr('in');
      ch.mustStr('file');
      break;

    case 'get':
      ch.mustStr('transport');
    case 'list':
      ch.mustStr('out');
    case 'delete':
    case 'mkdir': case 'mkdir-recursive':
    case 'rmdir': case 'rmdir-recursive':
      ch.mustStr('file');
      break;

    default: 
      ch.push('mode', '不支持的模式');
  }


  function connftp(rcb) {
    ftp_connect(cf, function(err, conn) {
      if (err) {
        ch.push('retmessage', ftp_msg(err));
        RCB(ch.getResult());
        return;
      }
      
      rcb(conn, function(data) {
        conn.end();
        if (data) {
          RCB(null, { 'retmessage': '成功', 'data': data });
        } else {
          RCB(ch.getResult());
        }
      });
    });
  }

  RCB(ch.getResult());
}


//
// 已经处理的错误消息
//
function ftp_connect(cf, rcb) {
  var Client = require('ftp-lib');
  var c = new Client();
  c.on('ready', function() {
    c._send('OPTS UTF8 ON', function(err, t, r) {
      if (err) {
        console.log('修改文件名编码:', ftp_msg(err));
      } else {
        // console.log(t,r);
      }
      rcb(null, c);
    });
  });
  c.on('error', rcb);
  c.connect(cf);
}


function run(interactive, not, is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var recv = interactive.getData();
  var data = recv.getData();
  var prog_fn, recursive = false;


  switch (conf.mode) {

    case 'rename':
      prog_fn = function(conn, over) {
        var path = get_target_file().split('/');
        path[ path.length-1 ] = conf.newname;
        var newf = path.join('/');
        conn.rename(get_target_file(), newf, over);
      };
      break;

    case 'append':
      prog_fn = function(conn, over) {
        var exp = tool.expression_complier(conf.in, true);
        var input = exp.val(data);
        var buf = new Buffer(input);
        conn.append(buf, get_target_file(), over);
      };
      break;

    case 'put':
      prog_fn = function(conn, over) {
        var exp = tool.expression_complier(conf.in, true);
        var input = exp.val(data);
        var buf = new Buffer(input);
        conn.put(buf, get_target_file(), over);
      };
      break;

    case 'get':
      prog_fn = function(conn, over) {
        var exp = tool.expression_complier(conf.out, true);

        conn.get(get_target_file(), function(err, reader) {
          if (err) return over(err);

          if (is_test) {
            reader.on('data', function(_data) {
              reader.pause();
              conn.abort();
              recv_over(null, _data.slice(0, 200));
            });
          } else {
            tool.recv_all_data(reader, 0, 0, recv_over);
          }

          function recv_over(err, rdata) {
            if (err) return over(err);
            if (conf.transport == 'ascii') {
              rdata = rdata.toString();
            }
            exp.val(data, rdata);
            over();
          }
        });
      };
      break;

    case 'list':
      prog_fn = function(conn, over) {
        var exp = tool.expression_complier(conf.out, true);

        conn.list(get_target_file(), function(err, list) {
          if (err) return over(err);
          if (is_test) { 
            if (list.length > 10) {
              list.length = 10;
            }
          }
          exp.val(data, list);
          over();
        });
      }
      break;

    case 'delete':
      prog_fn = function(conn, over) {
        conn.delete(get_target_file(), over);
      }
      break;
      
    case 'mkdir-recursive':
      recursive = true;
    case 'mkdir':
      prog_fn = function(conn, over) {
        conn.mkdir(get_target_file(), recursive, over);
      };
      break;
      
    case 'rmdir-recursive':
      recursive = true;
    case 'rmdir':
      prog_fn = function(conn, over) {
        conn.rmdir(get_target_file(), recursive, over);
      };
      break;

    default: 
      return do_next(new Error('不支持的模式'));
  }


  ftp_connect(conf, function(err, conn) {
    if (err) {
      conn && conn.end();
      do_next(err);
    } else {
      try {
        prog_fn(conn, function(err) {
          conn.end();
          do_next(err);
        });
      } catch(err) {
        conn.end();
        do_next(err);
      }
    }
  });


  function get_target_file() {
    if (data.__ftp_change_file__) {
      switch(data.__ftp_change_mode__) {
        default:
        case 'r':
          return data.__ftp_change_file__;

        case 'a':
          return conf.file + data.__ftp_change_file__;

        case 'f':
          var f = conf.file.split('/');
          f.pop();
          return f.join('/') + data.__ftp_change_file__;
      }
    }
    return conf.file;
  }


  function do_next(err) {
    if (err) {
      if (err.code) {
        err = new Error(ftp_msg(err, err.message));
      }
      tool.esb_error(err, interactive, data);
    }
    interactive.runOver(recv);
  }
}


function ftp_msg(err, addstr) {
  return ( addstr || '失败' ) + ' ' 
       + (ftp_codes[err.code] || '') 
       + (err.code ? ' [' + err.code + ']' : err);
}