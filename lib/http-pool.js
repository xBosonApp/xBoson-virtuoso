var http      = require('http');
var https     = require('https');
var urllib    = require('url');
var cluster   = require('cluster');
var logger    = require('logger-lib')('eeb');
var syscnf    = require('configuration-lib').load();
var clus_type = require('./type-cluster-msg.js');


var server_pool = {};
var port_pool = {};

// 强制使用固定端口
var MUST_USE_CONF_PORT = true;


module.exports = {
  // 不支持多进程和集群
  add_mid             : add_mid,
  remove_mid          : remove_mid,
  // 支持多进程和集群
  get_server          : get_server,
  master_port_manager : master_port_manager,
  use_port            : use_port,
  free_port           : free_port,
};


//
// 在主进程中分配 server 端口, 这个方法必须在主进程中启动
//
function master_port_manager() {

  cluster.on('fork', function(worker) {
    var workder_use = [];

    worker.on('message', function(msg) {
      if (msg.type !== clus_type.USE_PORT) return;

      var err;
      if (port_pool[ msg.port ]) {
        err = '端口被占用';
      } else {
        port_pool[ msg.port ] = 1;
        workder_use.push(msg.port);
      }

      worker.send({
        type : clus_type.USE_PORT_RET,
        port : msg.port,
        err  : err,
      });
    });

    worker.on('message', function(msg) {
      if (msg.type !== clus_type.FREE_PORT) return;
      delete port_pool[ msg.port ];
    });

    //
    // 当进程结束, 回收所有进程占用端口
    //
    worker.on('exit', function(code, signal) {
      workder_use.forEach(function(p) {
        delete port_pool[ p ];
      });
    });

  });
}


function use_port(port, rcb) {
  process.send({
    type : clus_type.USE_PORT,
    port : port,
  });

  process.on('message', on_ret);

  function on_ret(msg) {
    if (msg.type !== clus_type.USE_PORT_RET) return;
    if (msg.port != port) return;
    
    process.removeListener('message', on_ret);
    if (msg.err) {
      rcb(new Error(msg.err));
    } else {
      rcb();
    }
  }
}


function free_port(port) {
  process.send({
    type : clus_type.FREE_PORT,
    port : port,
  });
}


//
// 创建一个服务
// port       -- 服务端口
// secret     -- true 则启用 https
// auth       -- 验证中间件, 可以 null
// listener   -- 请求处理器
// rcb        -- Function(err, closer_fn, server)
// closer_fn  -- Functin(when_closed)
//
function get_server(url, port, secret, auth, listener, rcb) {
  var hlib = secret ? https : http;

  use_port(port, function(err) {
    if (err) {
      return rcb(err);
    } 
    create_server();
  });


  function create_server() {
    if (!auth) {
      auth = function(req, resp, next) {
        next();
      };
    }

    var server = hlib.createServer(function(req, resp) {
      auth(req, resp, function() {
        var requrl = urllib.parse(req.url).pathname;
        if (requrl.indexOf(url) == 0) {
          listener(req, resp, next);
        } else {
          next();
        }
      });

      function next(msg) {
        resp.statusCode = 404;
        resp.statusMessage = 'Not found';
        resp.writeHead(resp.statusCode);
        resp.end(msg);
      }
    });

    server.on('error', function(err) {
      var msg;

      switch (err.code) {
        case 'EADDRINUSE':
          msg = '端口被占用, 启动服务失败';
          break;
        default:
          msg = err.message;
      }

      _rcb(new Error(msg));
    });

    server.listen(port, function() {
      logger.debug('Listening on', server.address());
      _rcb(null, closer, server);
    });

    function closer(next) {
      var addr = server.address();
      server.close(function() {
        logger.debug('Server close', addr);
        free_port(port);
        next && next();
      });
    }
  }

  function _rcb(err) {
    if (rcb) {
      rcb.apply(this, arguments);
      rcb = null;
    } else {
      logger.error(err);
    }
  }
}


//
// 注册一个中间件, 使用指定的参数创建服务 
// url,   -- 可以是完整 uri 或只是路径
// port   -- 默认从配置文件读取, 
// secret -- {true/false} 默认 false, 
// fn     -- Function(Request, Response, next)
//
// 返回一个函数用于关闭连接
// rcb -- Function(err, closer_fn, server)
// closer_fn -- Function()
//
function add_mid(url, port, secret, fn, rcb) {
  var purl = _init_url(url, port, secret);
  url      = purl.pathname;
  port     = purl.port;

  var server_cnf = server_pool[port];
  if (!server_cnf) {
    //
    // 创建了 server_pool 中的元素
    //
    server_cnf = server_pool[port] = {
      urlmap : {},
      count  : 0,
      server : null
    };
  }

  var mid = server_cnf.urlmap[url];
  if (mid) {
    return rcb(new Error('url 已经被占用'));
  }

  mid = server_cnf.urlmap[url] = fn;
  server_cnf.count++;

  var server = server_cnf.server;

  if (!server) {
    server = server_cnf.server 
           = purl.protocol_lib.createServer(function(req, res) {

      var url   = urllib.parse(req.url).pathname;
      var midfn = server_cnf.urlmap[url];

      if (midfn) {
        midfn(req, res, next);
      } else {
        next();
      }

      function next(msg) {
        res.statusCode = 404;
        res.statusMessage = 'Not found';
        res.writeHead(res.statusCode);
        res.end(msg);
      }
    });

    try {
      server.listen(port, function() {
        logger.debug('Listening on', server.address());
        rcb(null, closer, server);
      });
    } catch(E) {
      rcb(new Error("创建服务器失败: " + url + ":" + port));
    }
  } else {
    rcb(null, closer, server);
  }


  function closer() {
    remove_mid(url, port);
  }
}


//
// 删除一个中间件
//
function remove_mid(url, port) {
  var purl = _init_url(url, port);
  url      = purl.pathname;
  port     = purl.port;
  
  var server_cnf = server_pool[port];
  if (server_cnf) {

    var mid = server_cnf.urlmap[url];
    if (mid) {
      delete server_cnf.urlmap[url];

      if (--server_cnf.count <= 0) {
        var addr = server_cnf.server.address();
        //
        // 尝试关闭连接, 如果有客户端连接, 并不会立即关闭 server
        //
        server_cnf.server.close(function() {
          logger.debug('Server close', addr);
          server_cnf.server = null;
        });
      }
    }
  }
}


//
// port 参数优先级比 url 中端口优先级高
// secret 参数优先级比 url 中协议优先级低
//
function _init_url(url, port, secret) {
  var purl = null;

  if (url.constructor === urllib.Url) {
    purl = url;
  }
  else if (typeof url == 'string') {
    purl = urllib.parse(url);
  }

  if (MUST_USE_CONF_PORT) {
    purl.port = syscnf.eeb_zy.http_server_port;
  } else {
    port = parseInt(port);

    if (port > 0 && port < 65535) {
      purl.port = port;
    } else {
      purl.port = syscnf.eeb_zy.http_server_port;
    }
  }

  if (purl.protocol) {
    secret = (purl.protocol == 'https');
  }

  if (secret) {
    purl.protocol_lib = https;
  } else {
    purl.protocol_lib = http;
  }

  return purl;
}