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
var clib    = require('configuration-lib');
var wslib   = require('websocket-lib');
var os      = require('os');
var fs      = require('fs');
var logger  = require('logger-lib')('eeb-mana');
var uuid    = require('uuid-zy-lib');
var iid     = require('./instanceid.js');


var conf2 = clib.load();
// 每次连接保存到模块变量中
var ws_client;
var SP = ' ';


//
// 多机集群管理模块
//
module.exports = {
  create_client   : create_client,
  put_rc_server   : put_rc_server,
  new_rc_server   : new_rc_server,
  del_rc_server   : del_rc_server,
  change_sche     : change_sche,
  get_job_group   : get_job_group,
  get_sche_data   : get_sche_data,
  varnish_rc      : varnish_rc,
};


//
// 以 id 作为 url 前缀, 区分不同的节点
// pss 密码每次请求必须有这个参数, 否则会拒绝服务
//
function create_client(id, pss) {
  var urlprefix     = '/' + id;
  var opt           = conf2.eeb_zy.ws_client;

  opt.proxy_target  = 'http://localhost:' + conf2.port + urlprefix;
  opt.prefix_url    = urlprefix;
  opt.proxy_path    = urlprefix;

  var _client = wslib.proxyClient(opt);
  var _os     = [os.type(), os.release(), os.platform(), os.arch(), get_version()];


  _client.on('connect', function() {
    iid.getnodeid(function(err, _id) {
      _client.emit('reg_work_node', {
        id     : _id,
        pss    : pss,
        ip     : 0,
        host   : os.hostname(),
        port   : conf2.port,
        prefix : urlprefix,
        os     : _os.join(SP),
        logusr : iid.getUserName(),
      });
    });
  });


  _client.on('getlist', function(msg) {
    require('./local-data.js').getlist(msg.type, function(err, data) {
      _client.emit('getlist_ret', {
        data : data,
        err  : pack_err(err),
      });
    });
  });


  _client.on('logger', function(msg) {
    var fn = msg.type;
    if (!logger[fn]) fn = 'log';
    logger[fn](msg.msg);
  });
  

  ws_client = _client;
  return _client;
}


function get_version() {
  var pk = fs.readFileSync(__dirname + '/../package.json');

  try {
    var v = JSON.parse(pk).version;
    return '[' + v + ']';
  } catch(err) {
    return '[' + err.message + ']';
  }
}


function put_rc_server(rc) {
  ws_client.emit('rc_conf_save', rc);
}


function new_rc_server(rc) {
  iid.getnodeid(function(err, _id) {
    ws_client.emit('rc_conf_new', {
      rc : rc,
      id : _id,
    });
  });
}


function del_rc_server(rid) {
  ws_client.emit('rc_conf_del', rid);
}


function change_sche(schedule) {
  ws_client.emit('change_sche', schedule);
}


function get_job_group(rid, rcb) {
  send_msg_to_center('get_job_group', {rid:rid}, rcb);
}


function get_sche_data(id, rcb) {
  send_msg_to_center('get_sche_data', {id:id}, rcb);
}


//
// 使用特例配置修改 rc 设置, 返回配置好的rc (rc本身会被修改)
// vid -- 特例 id, 如果空则返回原始 rc
// rc  -- 待修改的配置
// rcb -- Function(err, changed_rc) 即使发生错误, changed_rc 也是有效的
//
function varnish_rc(vid, rc, rcb) {
  if (!vid) {
    return rcb(null, rc);
  }

  send_msg_to_center('get_varnish', {vid:vid}, function(err, varnish_config) {
    if (!err) {
      mixrc(rc, varnish_config);
    }
    rcb(err, rc);
  });

  function mixrc(rc, varnish_config) {
    for (var tid in rc.targets) {
      var tar = rc.targets[tid];
      var src = varnish_config.targets[ tar.run_config.name ];
      if (src) {
        tar.run_config = clib.extends(tar.run_config, src.run_config);
      }
    }
  }
}


//
// 发送消息到中心, 并等待应答, 附加 data.retid
// 应答使用 data.retid 作为消息名称返回, 
// 返回的数据中必须有 {err, ret}
//
function send_msg_to_center(name, data, rcb) {
  var retid = uuid.v1();
  data.retid = retid;
  
  ws_client.emit(name, data);

  ws_client.once(retid, function(msg) {
    rcb(msg.err, msg.ret);
  });
}


//
// Error 对象不能正确 JSON.stringify, 专门针对它做转换
//
function pack_err(err) {
  if (!err) return;
  return {
    stack   : err.stack,
    message : err.message,
  };
}