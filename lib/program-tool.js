var flow    = require('./flow-data.js');
var event   = require('./type-event.js');
var etype   = require('./type-eeb.js');
var iid     = require('./instanceid.js');
var log     = require('logger-lib')('eeb');
var net     = require('mixer-lib').util.net();
var config  = require('configuration-lib').load();
var Event   = require('events').EventEmitter;
var vm      = require('vm');
var Iconv   = require('iconv').Iconv;
var uuid    = require('uuid-zy-lib');
var advtool = require('masquerade-html-lib').tool;

var zyconf        = config.eeb_zy;
var NOCHANGE      = {};
var sandbox_pool  = createSandboxPool();
var WAIT_NEXT     = {};


module.exports = {
  NOCHANGE          : NOCHANGE,
  WAIT_NEXT         : WAIT_NEXT,
  task_dispatch     : task_dispatch,
  zip_arr           : zip_arr,
  call_link         : call_link,
  create_tran_run   : create_tran_run,
  quick_cache       : quick_cache,
  zy                : zy,
  loop_event        : loop_event,
  monitor_event     : monitor_event,
  createJsbox       : createJsbox,
  esb_error         : esb_error,
  recv_all_data     : recv_all_data,
  soapClientClass   : soapClientClass,
  filter_jms_error  : filter_jms_error,

  create_esb_service_context     : create_esb_service_context,
  create_esb_service_out_context : create_esb_service_out_context,
  expression_complier            : expression_complier,
  createSandboxPool              : createSandboxPool,
};


//
// 删除数组中的空元素, 会改变数组内容和长度
// 参数中如果有多个数组, 则只判断第一个数组中的元素, 如果为空, 所有数组中对应位置
// 的元素都会删除, 所以要保证数组长度相同
//
function zip_arr() {

  var arr = arguments[0];
  if (!arr) return;

  for (var i=0; i<arr.length; ++i) {
    if ((!arr[i]) && arr[i] !== 0) {
      arr.splice(i, 1);

      for (var a = 1; a < arguments.length; ++a) {
        arguments[a].splice(i, 1);
      }

      --i;
    }
  }
}


//
// 创建一个 etl 目标的 run 通用方法
//
// conf -- 当前目标配置
// recv -- 接受数据的结构
// send -- 要发送数据的结构, 需要在返回前配置
// interactive -- 与内核交互
// event -- 用来接收事件, [end:拦截数据完成事件]
//
// create_filter: Function(conf, recv, send, interactive, event);
//
// create_filter 函数返回一个 Function Filter(data, saveToDataFn) 迭代每一行数据
// 如果返回 null 则返回一个空结果集
// 如果返回 NOCHANGE 则返回原数据集
// Filter 这个返回的函数在呼叫返回后才会迭代下一行数据
//
// 运行时会把每一行数据 data 传给该函数, 函数在处理完成后
// 调用 saveToDataFn(data) 会保存到流中, 或者不调用该函数
// 而是自行处理 data, 如果函数返回 WAIT_NEXT 需要自行调用
// next 方法让数据继续处理
// Filter : Function(data, saveToDataFn, next)
//
function create_tran_run(create_filter) {
  return run;

  function run(interactive, limit) {
    var root = interactive.getConfig();
    var conf = root.run_config;
    var recv = interactive.getData();
    var evt  = new Event();
    var runn = true;

    interactive.onStop(function() {
      runn = false;
    });

    try {
      var send = interactive.createFlow();
      var filter = create_filter(conf, recv, send, interactive, evt);

      if (!filter) {
        return interactive.runOver(send);
      }

      if (filter === NOCHANGE) {
        return interactive.runOver(recv);
      }

      var _do_task_fn = task_dispatch(_do_task, true);


      function _do_task() {
        try {
          if (runn && recv.has()) {
            recv.next();

            var data = recv.getData();
            var wait_next = null;

            wait_next = filter(data, function(ret_data) {
              send.push(ret_data);
            }, function() {
              if (wait_next === WAIT_NEXT) {
                _do_task_fn();
              }
            });

            if (wait_next !== WAIT_NEXT) {
              _do_task_fn();
            }

          } else {
            //
            // 发送结束消息, 如果没有接收器, 则默认发送结束数据
            //
            if (!evt.emit('end')) {
              interactive.runOver(send);
            }
          }
        } catch(err) {
          interactive.sendEvent(event.ERROR, err);
          log.debug(err);
        }
      } // [End] _do_task

    } catch(err) {
      interactive.sendEvent(event.ERROR, err);
      log.debug(err);
    }
  }
}


//
// 有一些过程的运行是同步的大循环, 长时间运行后会导致UI没有响应
// 使用这个方法包装循环
//
// 返回对 fn 函数的包装器, 即使循环调用, 也不会造成程序锁定
// obj -- 是可选的 this 上下文
// firstCall -- 如果为 true, 会初始化后运行一次 (无参调用!)
//
function task_dispatch(fn, firstCall, obj) {
  var count = 0;
  var max = 20;

  var ret = function() {
    if (++count > max) {
      count = 0;
      var arg = arguments;

      setImmediate(function() {
        fn.apply(obj, arg);
      });
    } else {
      fn.apply(obj, arguments);
    }
  };

  if (firstCall) {
    setImmediate(ret);
  }

  return ret;
}


//
// 创建一个调用链
//
function call_link() {
  var first = null;

  //
  // 把一个函数加入调用链,
  //
  // -- data 始终是首次调用 call 时传入的参数
  // -- next : Function() 无参数调用, 继续下一条函数调用
  // renderFn: function(data, next)
  //
  function add(renderFn) {
    if (!first) {
      first = renderFn;
    } else {
      var prv = first;

      first = function(data, next) {
        prv(data, function() {
          renderFn(data, next);
        });
      }
    }
  }

  //
  // 只能传递一个参数
  // data -- 在调用链中传递的参数
  // last_call -- Function(data) 之前的调用全部成功并且调用了 next()
  //              则最后调用该函数, 参数是最初的 data
  //
  var call = function(data, last_call) {
    if (first) {
      first(data, function() {
        last_call && last_call(data);
      });
    } else {
      last_call && last_call(data);
    }
  }

  call.add = add;

  return call;
}


//
// 创建快速缓存对象
// 策略: 经常读取的对象保持的更久
// line_count -- 缓存保存的最大数据量
//
function quick_cache(line_count, max_age) {
  var _cache = {};
  var _idx   = [];
  var curr   = -1;
  var tcall  = 0;
  var ycall  = 0;

  //
  // 缓存最大值年龄影响命中率
  // 增大缓存行会增加命中率
  // 但是增大命中率也可能导致速度下降
  //
  if ((!max_age) || max_age < 1)
    max_age = 3;


  if ((!line_count) || line_count < 1)
    line_count = 200;


  //
  // 从缓存总取出, 可以返回 null
  //
  function get(index) {
    var c = _cache[index];
    ++tcall;

    if (!c)
      return null;

    ++ycall;

    if (c.count < max_age)
      ++c.count;

    return c.data;
  }

  //
  // 存入缓存
  //
  function save(index, data) {
    var cache_idx = null,
        cache_obj = null;

    for (;;) {
      if (++curr >= line_count) {
        curr = 0;
      }

      cache_idx = _idx[curr];

      if (cache_idx) {
        cache_obj = _cache[cache_idx];

        if (--cache_obj.count <= 0) {
          delete _cache[cache_idx];
          break;
        }
      } else {
        break;
      }
    }

    _cache[index] = {
      data  : data,
      count : 0
    };

    _idx[curr] = index;
  }

  //
  // 清理内存
  //
  function clear() {
    _cache = {};
    _idx   = [];
  }

  //
  // 打印调试消息
  //
  function printInfo() {
    console.log("缓存命中率", ycall, tcall, '--',
                Number(ycall/tcall).toFixed(3), '%');
  }


  return {
    get   : get,
    save  : save,
    clear : clear,
    info  : printInfo
  };
}


//
// 这是一个中间件, 客户端配合 eeb.callZyapi
//
function zy(req, resp, errorHand, success) {
  var api  = req.query.api;
  var sys  = req.query.sys;
  var type = etype[ req.query.className ];

  if (!api) {
    return errorHand(new Error('parm api invalid'));
  }

  var url = [];
  var _ = function(t) { url.push(t); return _; };


  iid.get(function(ierr, _id) {
    if (ierr) return errorHand(ierr);

    _("http://")(zyconf.ip)(':')(zyconf.port)('/ds/api/')(api);
    _('?sys=')(sys || _id[type]);

    for (var n in req.query) {
      _('&')(n)('=')(req.query[n]);
    }

    url = url.join('');
    // console.log('call zy api:', url);

    net.get(url, null, function(err, data) {
      if (err) return errorHand(err);
      success(data.txt());
      // console.log(data.txt())
    });
  });
}


//
// 循环注册事件
//
function loop_event(interactive, eventname, fn) {
  interactive.retEventPersistent(eventname, fn);
}


//
// 监听一个事件, 当触发时执行一个方法, 然后转发到上层
//
function monitor_event(interactive, eventname, fn) {
  log.warn('!!! call monitor_event() on `program-tool.js` do not do');
  interactive.regEvent(eventname, function(a) {
    try {
      fn(a);
    } catch(err) {
      console.log(err);
    }

    interactive.sendEvent(eventname, a);
  });
}


//
// 沙箱不会被垃圾回收, 所以要保存起来循环使用
//
function createSandboxPool() {
  var spool = [];

  function set_default_prop(_box) {
    _box.String  = String;
    _box.Date    = Date;
    _box.Number  = Number;
    _box.Math    = Math;
    _box.Buffer  = Buffer;
  }

  // 获取一个未使用的沙箱对象
  function get() {
    var box = spool.pop();
    if (!box) {
      box = vm.createContext();
    }
    return box;
  }

  // 释放沙箱到池中
  function free(_box) {
    for (var n in _box) {
      delete _box[n];
    }
    spool.push(_box);
  }

  return {
    get : get,
    free : free
  }
}


//
// 创建一个沙箱, 来自于沙箱池
//
function createJsbox(jscode, name) {

  var opt       = { filename: name || '脚本', displayErrors: true };
  var js        = new vm.Script(jscode, opt);
  var box       = sandbox_pool.get();
  var argv_map  = { };

  var ret = {
    get     : get,
    set     : set,
    run     : run,
    free    : free,
    getbox  : getbox,
    compile : compile,
  };

  function set(name, v) {
    box[name] = v;
    argv_map[name] = v;
  }

  function get(name) {
    return box[name];
  }

  //
  // 返回脚本运行上下文
  //
  function getbox() {
    return box;
  }

  //
  // ETL 调用
  //
  function run() {
    return js.runInContext(box);
  }

  //
  // ESB 调用
  // 使用参数列表编译代码, run/compile 择其一运行
  // 该函数返回一个对象, 其中 run 来运行代码
  //
  function compile() {
    var ns = [], vs = [];
    for (var n in argv_map) {
      ns.push([n]);
      vs.push(argv_map[n]);
    }

    var code = [
      '(function(', ns.join(','), ') {', jscode, "\n})"
    ];

    var jsfn = new vm.Script(code.join(''), opt).runInContext(box);
    return {
      run : function() {
        jsfn.apply(this, vs);
      },
    }
  }

  // 必须调用, 否则内存泄漏
  function free() {
    sandbox_pool.free(box);
    js = box = opt = undefined;
  }

  return ret;
}


//
// ESB 出错时调用, 固定输出到 data.error 这个数组中
// 数组的元素是错误字符串
//
function esb_error(err, interactive, data) {
  interactive.log('发生错误', err.message);
  interactive.bizlog('err', err.message);

  if (!data) {
    throw new Error('没有可用于运行的数据, 或节点连接错误');
  }

  var arr = data.error;
  if (!arr) arr = data.error = [];
  arr.push(interactive.getConfig().tname + ': ' + err.message);
}


//
// 从 reader 中读取所有数据传送给 fn
// 如果数据太大, 会导致内存溢出
//
// reader   -- 输入流
// in_code  -- 输入编码, 如果空, 则保持数据格式为 Buffer, 否则输出 String
// out_code -- 输出编码, 如果与 in_code 不同则会自动转码
// fn      -- Function(err, buffer)
//
function recv_all_data(reader, in_code, out_code, fn) {
  var buffers = [];
  var iconv = null;

  if (in_code) {
    if (out_code && (in_code != out_code)) {
      iconv = new Iconv(in_code, out_code);
    }
  }

  reader.on('data', function(_data) {
    buffers.push(new Buffer(_data));
  });

  reader.on('end', function() {
    var retBuf = Buffer.concat(buffers);
    buffers = null;

    try {
      if (in_code) {
        if (iconv) {
          retBuf = iconv.convert(retBuf);
        }
        retBuf = retBuf.toString();
      }
      fn(null, retBuf);

    } catch(err) {
      fn(err);
    }
  });
}


//
// soap 没有导出 Client 对象, 间接的取到这个对象
//
function soapClientClass(rcb) {
  var _soap_client;

  try {
    _soap_client = require('../node_modules/soap/lib/client.js').Client;
    rcb(null, _soap_client);
  } catch(_err) {
    rcb(_err);
  }
}


//
// 返回过滤后的消息字符串
//
function filter_jms_error(err) {
  var msg = err.message;
  var f   = 'javax.jms.JMSException:';
  var b   = msg.indexOf(f);
  if (b < 1) return msg;
  var e   = msg.indexOf("\n", b);
  var msg = msg.substring(b+f.length, e);
  return msg ? msg.trim() : err.message;
}


//
// esb 服务调用该方法创建一个请求应答环境, 自动写日志
// interactive
// response_fn -- response_fn(flow, ret_field, _over) 下面定义 [t268]
//
function create_esb_service_context(interactive, response_fn) {
  var checkid = {};
  var stop = false;

  var ret = {
    request : request,
    start   : start,
    stop    : false,
  };

  interactive.onStop(function() {
    ret.stop = stop = true;
  });


  interactive.retEventPersistent(event.END, when_end);
  interactive.retEventPersistent(event.SERVEICE_RESPONSE, response);


  function when_end() {
    /* 这是一个空的事件拦截器 */
  }


  //
  // 服务启动时调用, 写出必要的日志消息, 必须调用 !
  // msg -- 启动消息
  //
  function start(msg) {
    interactive.sendEvent(event.STATISTICS, { txt: msg });
    interactive.sendEvent(event.STATISTICS_END);
  }

  //
  // 当服务被请求时, 调用该方法注册各种消息
  // head -- flow 中的 head
  // msg  -- 服务被请求时的日志消息
  //
  function request(head, msg) {
    if (stop) return;
    var reqid = head.request_id = uuid.v4();
    checkid[ reqid ] = 1;

    interactive.log('处理服务请求', head.request_id);

    interactive.sendEvent(event.SERVICE_BEG_LOG,
        { time: Date.now(), request_id: reqid, msg: msg });
  }


  function response(rdata) {
    if (stop) return;
    var recv = rdata.data;
    var head = recv.getHead();

    if (!checkid[ head.request_id ]) {
      interactive.sendEvent(event.ERROR, new Error('应答与请求不在一个闭环中'));
      return;
    }

    delete checkid[ head.request_id ];
    //
    // response_fn 的调用 [t268]
    //
    // recv      -- flow 数据
    // ret_field -- out 返回的数据
    // rcb       -- Funciont(err, msg) 调用以结束请求
    //
    response_fn(recv, rdata.ret_field, _over);


    function _over(err, msg) {
      if (err) {
        interactive.sendEvent(event.ERROR, err);
      }
      rdata.over(head.request_id);
      interactive.sendEvent(event.SERVICE_END_LOG,
          { time: Date.now(), request_id: head.request_id, msg: msg });
    }
  }

  return ret;
}


//
// 创建一个 esb 服务器回调包, 用在返回目标中
// 此时, 目标不再需要调用 interactive.runOver
//
function create_esb_service_out_context(interactive) {
  var stop = false;

  var ret = {
    end  : _end,
    stop : false,
  };

  interactive.onStop(function() {
    ret.stop = stop = true;
  });


  function _end(ret_data) {
    if (stop) return;
    var recv = interactive.getData();

    interactive.sendEvent(event.SERVEICE_RESPONSE, {
      //
      // 这里定义了 SERVEICE_RESPONSE 消息的数据结构
      // ret_field -- 返回给应答的数据
      //
      data      : recv,
      over      : when_over,
      ret_field : ret_data
    });


    function when_over(_id) {
      if (stop) return;
      interactive.log('请求处理完成', _id);
      interactive.runOver(recv);
    }
  }

  return ret;
}


//
// 封装了 advtool 的相同函数, 并提供 Buffer 的反解析功能
//
function expression_complier(text, easy_exp) {
  var exp = advtool.expression_complier(text, easy_exp);
  var ret = { val: val };

  function val() {
    var r = exp.val.apply(exp, arguments);
    //
    // 测试时, 把浏览器发回的数据转换为 Buffer 对象
    //
    if (r && r.type === 'Buffer' && r.data && r.data.constructor === Array) {
      r = new Buffer(r.data);
    }
    return r;
  }

  return ret;
}
