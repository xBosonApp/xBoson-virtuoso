var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var htpool  = require('../http-pool.js');
var net     = require('dgram');


var __NAME  = 'esb-lk-udp-client';


var pg_cnf = module.exports = {
  name          : "UDP 客户端",
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


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustNum('port', 10, 65535);
  ch.mustStr('host', 1, 255);
  ch.mustStr('fout', 1, 255);

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var cf = {
    name     : pg_cnf.name,
    host     : 'localhost',
    port     : '',
    fout     : 'udp_client',
    type     : '4',
  };
  RCB(null, cf);
}


function run(interactive, limit, is_test) {
  var root  = interactive.getConfig();
  var conf  = root.run_config;
  var recv  = interactive.getData();
  var data  = recv.getData();
  var over  = false;
  var type  = conf.type == '6' ? 'udp6' : 'udp4';


  try {
    var exp = tool.expression_complier(conf.fout, true);

    if (is_test) {
      exp.val(data, {
        send    : 'Function send(sendata, callback) {}',
        close   : 'Function close() {}',
        socket  : 'Object',
        message : '无法进行测试, 保存后运行来测试效果',
      });
      _over();
      return;
    }

    var sock = net.createSocket(type);
    sock.on('error', _over);
    sock.bind({ exclusive: true }, _over);
    interactive.onStop(_close);

    exp.val(data, {
      send   : _send,
      close  : _close,
      socket : sock,
    });


    function _send(_data, rcb) {
      if (_data) {
        if (_data.constructor === String) {
          _data = new Buffer(_data);
        }
        sock.send(_data, 0, _data.length, conf.port, conf.host, rcb);
      } else {
        rcb && rcb(new Error('data null'));
      }
    }

    function _close() {
      sock.close();
    }
  } catch(err) {
    _over(err);
  }


  function _over(err) {
    if (err) {
      return tool.esb_error(err, interactive, data);
    }
    if (!over) {
      interactive.runOver(recv);
      over = true;
    }
  }
}
