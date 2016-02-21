require('./init_java.js');

var clib    = require('configuration-lib');
var express = require('express');
var mixer   = require('mixer-lib');
var logger  = require('logger-lib')('eeb');
var cluster = require('cluster');
var uuid    = require('uuid-zy-lib');
var iid     = require('./lib/instanceid.js');
var log_sys = require('./lib/log-sys.js');
var nm      = require('./lib/node-manager.js');
var htpool  = require('./lib/http-pool.js');


if (cluster.isWorker) {
  //
  // 集群时, 创建真正的运行时内核
  //
  require('./lib/core-cluster.js').createCore();
  
} else {

  // 导出函数, 框架回调
  module.exports = function(app_pool) {
    var route_saver = mixer.create_route_saver();
    var app = express();
    var mid = require('./lib/mid.js');
    var id  = uuid.v4();
    var ps  = uuid.v4();

    var _client = nm.create_client(id, ps);
    log_sys.set_ws_client(_client);

    app.use( route_saver('/' + id + '/eeb/service'), mid(ps) );

    var route = app_pool.addApp(mixer.express(app));
    route.add(route_saver);
    
    logger.info("routes: ", app_pool.route_list());
  };


  function startServer() {
    var conf = {
      whenLoad: module.exports };
    mixer.create_http_mix_server(conf);
  }


  clib.wait_init(function() {
    clib.save(clib.load(), function() {
      logger.log('Config file rebuild');

      //
      // 作为主机时, 启用集群日志服务器
      //
      log_sys.master_log_listener();
      htpool.master_port_manager();

      //
      // 这段代码允许这个脚本独立运行
      //
      if (!module.parent) {
        iid.get(function(err, id) {
          logger.info('instance id', err || 'success');
          startServer();
        });
      }

    });
  });

}