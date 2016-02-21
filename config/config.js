var path = require('path');
var uuid = require('uuid-zy-lib');
var clib = require('configuration-lib');

//
// 在磁盘上建立如下目录
// 所有相关的配置都保存在这里
//
var local_dir = clib.nodeconf + '/virtuoso-config';


module.exports = {

  port : 8014,
  ext_config_file : local_dir + '/config.json',


  logger : {
    logLevel      : 'INFO',
    log_dir       : local_dir + '/logs',
    log_size      : 5 * 1024 * 1024,
    reserve_count : 30,
  },


  eeb_zy: {
    // 是否有平台开关
    has_zy_server : true,

    // 平台的 ip 和 port
    ip   : 'zr-i.com',
    port : 80,
    
    // 上传文件最大尺寸
    upload_maxsize : 20 *1024 * 1024,

    // 本地数据库目录
    local_db_dir   : local_dir,

    // http 客户端统一端口
    http_server_port : 8001,

    ws_client : {
      server_url  : 'http://zr-i.com:8013',
      proxy_pw    : '3n6$5432.fxnvfje3w',
    }
  },


  job_server : {
    // 在保存数据时使用的命名空间, 
    // 允许多个服务连接到一个 redis 上而不发生冲突
    save_space : uuid.v4(),
  },


  redis_conf : {
    host     : "localhost",
    port     : "6379",
    db       : 0,
    defaultExpiration      : 7200,

    options  : {
      enable_offline_queue : true,
      max_attempts         : 3,
      auth_pass            : ''
    }
  },


  masquerade : {
    extname        : 'htm',
    depth_max      : 10,
    cache_time     : 60 * 60,
    max_file_size  : 2 * 1024*1024,
    encoding       : 'utf8',
    default_page   : 'index.htm'
  },
};