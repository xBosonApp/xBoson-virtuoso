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
var data_src    = require('./local-data.js');
var progfact    = require('./program-factory.js');
var corelib     = require('./core-cluster.js');
var flow        = require('./flow-data.js');
var file_pool   = require('./file-pool.js');
var tool        = require('./program-tool.js');
var instancelib = require('./instanceid.js');
var CATE        = require('./type-eeb.js');
var nm          = require('./node-manager.js');

var logger      = require('logger-lib')('eeb');
var uuid        = require('uuid-zy-lib');
var querystring = require('querystring');
var config      = require('configuration-lib').load();
var net         = require('mixer-lib').util.net();
var job         = require('job-server-prj');
var redis       = require('cache-redis-lib');
var util        = require('util');

var service_address = 'http://localhost:' + config.port;
var cache_prefix    = job.mid.getCachePrefix();
var zyconf          = config.eeb_zy;
var core            = corelib.createCore();
var rclient         = redis.createClient();
var jobmid          = job.mid;

jobmid.setJobFnFactory(sche_factory);


var periodTypeMap = {
  y: '每年',   M: '每月',    ew: '每周',    ed: '每日',
  d: '每几天', h: '每几小时', m: '每几分钟', s: '每几秒',

  '10' : '立即执行', '20' : '一次性任务', '30' : '每年',
  '31' : '每月',     '40' : '每周',       '50' : '每日',  '60' : '每几天',
  '70' : '每几小时', '80' : '每几分钟',   '90' : '每几秒',
};

var ONE_PAGE_SIZE = 15;


module.exports = function(password) {

  // 绑定服务处理器; '服务名':处理函数
  var fn = {
    'getlist'     : getlist,
    'newrc'       : newrc,
    'saverc'      : saverc,
    'getrc'       : getrc,
    'rename'      : rename,
    'delrc'       : delrc,
    'proglist'    : proglist,
    'uuid'        : getuuid,
    'zy'          : tool.zy,
    'testhttp'    : testhttp,
    'importrc'    : importrc,
 // 'getiid'      : getiid, iid 将与 sys 合并, 不能暴露这个参数
    
    'inittarget'  : inittarget,
    'checktarget' : checktarget,
    'testtarget'  : testtarget,
    'run'         : run,
    'test'        : test,
    'his'         : his,
    'state'       : state,
    'stop'        : stop,

    'sche_start'  : sche_start,
    'sche_stop'   : sche_stop,
    'sche_info'   : sche_info,
    'sche_state'  : sche_state,
    'job_state'   : job_state,

    'fp_get'      : file_pool.get,
    'fp_up'       : file_pool.upload,
    'fp_del'      : file_pool.del,
    'fp_list'     : file_pool.list,
  };


  function __mid(req, resp, next) {
    // 密码验证
    if (req.query.pss != password) {
      resp.statusCode = 417;
      resp.end();
      return;
    }

    if (typeof req.query.fn != 'string') {
      return errorHand(new Error('`fn` must not array'));
    }

    var process = fn[req.query.fn];

    if (process) {
      process(req, resp, errorHand, success);
    } else {
      next();
    }

    //
    // err -- new Error(...)
    //
    function errorHand(err) {
      var ret = {
        ret: 1, msg: err.message || err
      };
      resp.end(JSON.stringify(ret));
      // logger.error(err.message || err);
    }

    //
    // obj         -- 返回到客户端的数据 保存在 data 属性中
    // _direct_ret -- 如果 true, 则把 obj 不加包装直接返回, 并且 _ext_data 无效
    // _ext_data   -- 扩展数据 保存在 ext 属性中
    //
    function success(obj, _direct_ret, _ext_data) {
      var ret = null;
      if (_direct_ret) {
        ret = obj;
      } else {
        ret = {
          ret: 0, msg: null, data: obj || '成功',
          ext: _ext_data
        };
      }
      resp.end(JSON.stringify(ret));
    }
  }

  return __mid;
};


function proglist(req, resp, errorHand, success) {
  var type = req.query.t;

  progfact.getProgramList(type, function(err, list) {
    if (err) errorHand(err);
    success(list);
  });
}


function saverc(req, resp, errorHand, success) {
  easyBodyParse(req, errorHand, function(data) {
    var rc = JSON.parse(data);

    core.checkRunnerConfig(rc, function(err) {
      if (err) return errorHand(err);

      data_src.saverc(rc, function(err, d) {
        if (err) return errorHand(err);
        nm.put_rc_server(rc);
        success(d);
      });
    })
  });
}


function importrc(req, resp, errorHand, success) {
  easyBodyParse(req, errorHand, function(data) {
    var rc = JSON.parse(data);
    rc.rid = uuid.v4();

    var s = rc.schedule;
    if (s) {
      s.id     = rc.rid;
      s.__rid  = rc.rid;
      s.__type = rc.className;

      while (s.__next_schedule) {
        s = s.__next_schedule;
        s.id = uuid.v4();
        s.__rid  = rc.rid;
        s.__type = rc.className;
      }
    }

    core.checkRunnerConfig(rc, function(err) {
      if (err) return errorHand(err);

      data_src.saverc(rc, function(err, d) {
        if (err) return errorHand(err);
        nm.new_rc_server(rc);
        nm.put_rc_server(rc);
        success(d);
      });
    })
  });
}


function rename(req, resp, errorHand, success) {
  var rid  = req.query.rid;
  var name = req.query.name;
  var type = req.query.t;
  var cid  = req.query.cid;

  data_src.rename(rid, cid, name, type, function(err) {
    if (err) return errorHand(err);
    success();
  });
}


function newrc(req, resp, errorHand, success) {
  var type = parseInt(req.query.t);
  var name = req.query.name;

  if (type != CATE.ETL && type != CATE.ESB && type != CATE.BPM) {
    return errorHand(new Error("not valid type " + type));
  }

  //
  // 这里决定任务初始化配置
  //
  var rc = {
    name      : name || '未命名',
    rid       : uuid.v4(),
    className : type,
    schedule  : {},
    targets   : {},
    dependent : {}
  };

  data_src.saverc(rc, function(err, d) {
    if (err) return errorHand(err);
    nm.new_rc_server(rc);
    success(rc);
  });
}


function getrc(req, resp, errorHand, success) {
  var type = parseInt(req.query.t);
  var rid = req.query.rid;

  data_src.getrc(rid, type, function(err, rc) {
    if (err) return errorHand(err);
    success(rc);
  });
}


function delrc(req, resp, errorHand, success) {
  var type = parseInt(req.query.t);
  var rid = req.query.rid;

  function _rm() {
    data_src.delrc(rid, type, function(err) {
      if (err) return errorHand(err);
      nm.del_rc_server(rid);
      success();
    });
  }

  data_src.getrc(rid, type, function(err, rc) {
    if (err) {
      // ENOENT : 客户端已经没有这个文件, 但是服务端有记录, 删除之
      if (err.code == 'ENOENT') nm.del_rc_server(rid);
      return errorHand(err);
    }

    var s = rc.schedule;
    while (s) {
      rclient.remove(cache_prefix + s.id);  
      s = s.__next_schedule;  
    }
    _rm();
  });
}


function must_etl(req) {
  var type = parseInt(req.query.t);
  if (type != CATE.ETL) {
    return errorHand(new Error("not valid type " + type));
  }
  return type;
}


function sche_start(req, resp, errorHand, success) {
  var id = req.query.id;

  nm.get_sche_data(id, function(err, schedule) {
    schedule = JSON.parse(schedule);
    schedule.method = 'fact';

    rclient.setJSON(cache_prefix + schedule.scheduleid, schedule, function() {
      jobmid.start({id: schedule.scheduleid}, function(ret) {
        success(ret, true);
      });
    }, errorHand);
  });
}


function sche_stop(req, resp, errorHand, success) {
  var type = must_etl(req);
  var id  = req.query.id;

  rclient.getJSON(cache_prefix + id, function(schedule) {
    jobmid.stop({ id: id }, function(__ret) {
      var _identify = schedule.scheduleid + ':' + schedule.__rid;
      core.stop(_identify, function(err, ret) {
        // if (err) return errorHand(err);
        success(ret);
      });
    });
  }, function(err) {
    errorHand(new Error('任务没有运行'));
  });
}


function sche_factory(parm) {
  var job_sleep;

  return function(_job_sleep, job_info) {
    job_sleep = _job_sleep;

    //
    // 扩展参数的定义 [mid386]
    //
    var ext = {
      sche_id    : job_info.job_id,
      grp_id     : parm.__gid,
      varnish_id : parm.__vid,
    };

    var _identify = job_info.job_id + ':' + parm.__rid;

    //
    // 依赖于 schedule 的 __rid, __type 属性才能正常运行
    //
    _getAndRun(parm.__rid, parm.__type, 
               errorHand, success, 'run', ext, _identify, job_sleep);
  }

  function errorHand(err) {
    logger.error(err);
    job_sleep();
  }

  function success(msg) {
    // ! 没有等待任务结束时返回
    logger.info(msg);
    // job_sleep();
  }
}


function getlist(req, resp, errorHand, success) {
  // ETL:1, ESB:2, BPM:4
  var type = parseInt(req.query.t);

  //
  // data:
  // { name: '模型测试',
  //   rid: 'fd081e44-759e-45c1-83db-519bf89b8aad',
  // }
  //
  data_src.getlist(type, function(err, data) {
    if (err) return errorHand(err);
    success(data);
  });
}


// 返回内核的运行状态, 名称起的不咋地
function sche_state(req, resp, errorHand, success) {
  var type  = parseInt(req.query.t);
  var idarr = req.query.rid;
  var i     = -1;
  var data  = {};
  var crid  = 0;
  var fn    = 0;

  if ((!idarr) || idarr.length < 1) {
    return errorHand(new Error('没有状态信息'));
  }

  if (!util.isArray(idarr)) {
    idarr = [ idarr ];
  }

  for (var j=0; j<idarr.length; ++j) {
    data[ idarr[j] ] = { /* rid: idarr[j] */ };
  }

  switch (type) {
    case CATE.ESB:
      fn = _esb_data;
      _loop();
      break;

    case CATE.ETL:
      fn = _etl_data;
      _loop();
      break;

    default:
      errorHand(new Error('cannot support.'));
  }


  function _loop() {
    if (++i >= idarr.length) {
      success(data);
    } else {
      crid = idarr[i];
      fn();
    }
  }

  function _etl_data() {
    _set_run_state(_loop);
  }

  function _esb_data() {
    _set_run_state(_loop);
  }

  function _set_run_state(_t_next) {
    core.getHistory(crid, 0, 0, function(err, his) {
      data[ crid ].run_state 
           = ( err && err.message ) 
          || ( his && corelib.STA_NAME[ his.state ] );
      _t_next && _t_next();
    });
  }
}


// 返回任务的运行状态, 名称起的不咋地
function job_state(req, resp, errorHand, success) {
  var type  = parseInt(req.query.t);
  var idarr = req.query.rid;
  var data  = {};
  var crid  = 0;
  var fn    = 0;

  if ((!idarr) || idarr.length < 1) {
    return errorHand(new Error('没有状态信息'));
  }

  if (!util.isArray(idarr)) {
    idarr = [ idarr ];
  }

  for (var j=0; j<idarr.length; ++j) {
    data[ idarr[j] ] = { job_state: '未启动' };
  }

  jobmid.info({ id: idarr, not_cut_his: false }, function(ret) {
    ret.list.forEach(function(jinfo, i) {
      if (!jinfo.job_id) 
        return;
      
      data[ jinfo.job_id ] = { 
        job_state : job.lib.KEY.STATUS_CN[ jinfo.cd ]
      };
    });
    success(data);
  });
}


function sche_info(req, resp, errorHand, success) {
  var type = must_etl(req);
  var rid  = req.query.rid;
  var his = [];

  rclient.getJSON(cache_prefix + rid, function(schedule) {
    var s = schedule;
    _next();

    function _next() {
      jobmid.info({ id: s.id, not_cut_his: true }, function(ret) {
        if (ret.list[0]) {
          ret.list[0].history.forEach(function(h) {
            h && his.push(h);
          });
        }

        s = s.__next_schedule;
        if (s) {
          _next();
        } else {
          success(his);  
        }
      });
    }
  }, function() {
    errorHand(new Error('没有任务运行历史记录'));
  });
}


function inittarget(req, resp, errorHand, success) {
  var pid = req.query.pid;

  progfact.getProgram(pid, function(err, prog) {
    if (err) return errorHand(err);

    prog.createConfig(function(err1, progconf) {
      if (err1) return errorHand(err1);
      success(progconf);
    });
  });
}


function checktarget(req, resp, errorHand, success) {
  easyBodyParse(req, errorHand, function(data) {
    var tconf = JSON.parse(data);

    progfact.getProgram(tconf.programID, function(err, prog) {
      if (err) return errorHand(err);

      prog.checkConfig(tconf.run_config, function(err, msg) {
        // console.log(err, msg);
        if (err) {
          success(err);
        } else {
          if (!msg) {
            msg = { retmessage : '成功' };
          }
          msg.noerror = true,
          success(msg);
        }
      });
    });
  });
}


function testtarget(req, resp, errorHand, success) {
  easyBodyParse(req, errorHand, function(data) {
    var _d = JSON.parse(data);

    var targetConf = _d.tc;
    var className  = _d.t;
    var _flow_data = flow.auto_data(null, className);

    if (_d.data) {
      _flow_data.__from_original(_d.data);
    }

    core.test_target(className, targetConf, _flow_data, function(err, fdata) {
      if (err) return errorHand(err);
      success(fdata);
    });
  });
}


function run(req, resp, errorHand, success) {
  var rid = req.query.rid;
  var type = parseInt(req.query.t);
  _getAndRun(rid, type, errorHand, success, 'run');
}


function test(req, resp, errorHand, success) {
  var rid = req.query.rid;
  var type = parseInt(req.query.t);
  _getAndRun(rid, type, errorHand, success, 'test');
}


function getiid(req, resp, errorHand, success) {
  var type = parseInt(req.query.t);

  instancelib.get(function(err, _id) {
    if (err) return errorHand(err);
    var iid = _id[ CATE[type] ];
    success(iid);
  });
}


//
// 通过 rid 获取流配置, 然后在内核上运行
// __ext.varnish_id -- 加载特例配置
//
function _getAndRun(rid, type, errorHand, success, fnName, __ext, _identify, _on_stop) {
  data_src.getrc(rid, type, function(err, rc) {
    if (err) return __rcb(err);
    var vid = __ext && __ext.varnish_id;

    nm.varnish_rc(vid, rc, function(err, v) {
      if (err) logger.error('特例设置失败', err); // 忽略错误

      var runinfo = core.run(rc, __rcb, _identify, fnName == 'test', __ext);
      _on_stop && runinfo.onStop(_on_stop);
    });
  });

  function __rcb(err, ret) {
    if (err) return errorHand(err);
    success(ret);
  }
}


function his(req, resp, errorHand, success) {
  var rid = req.query.rid;

  core.getHistory(rid, 0, 10, function(err, _his) {
    if (err) return errorHand(err);
    success(_his);
  });
}


function checkdir(dir) {
  if (dir && dir.indexOf('..') >= 0) 
    throw new Error("非法的路径:" + dir);
  return dir;
}


function state(req, resp, errorHand, success) {
  var rid = req.query.rid;

  core.getCurrentState(rid, function(err, d) {
    if (err) return errorHand(err);
    success(d);
  });
}


function stop(req, resp, errorHand, success) {
  var rid = req.query.rid;

  core.stop(rid, function(err, ret) {
    if (err) return errorHand(err);
    success(ret);
  });
}


// 用来测试 http 请求, 其他什么也不做
// notlog 设置控制台不回显
function testhttp(req, resp, errorHand, success) {
  var notlog = req.query.notlog;
  notlog || console.log('query:', req.query);

  easyBodyParse(req, errorHand, function(_nul, str) {
    notlog || console.log('post body:', str);
    success(1);
  }, true);
}


// 客户端配合 postService
function easyBodyParse(req, errorHand, success, _not_json) {
  var buf = [];

  req.on('data', function(data) {
    buf.push(data);
  });

  req.on('end', function() {
    var str = Buffer.concat(buf).toString();
    var ret = _not_json || querystring.parse(str);
    success(ret.data, str);
  });
}


// 方便的工具服务
function getuuid(req, resp, errorHand, success) {
  success(uuid.v4());
}
