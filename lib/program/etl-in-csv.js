var uuid    = require('uuid-zy-lib');
var checker = require('../checker.js');
var flow    = require('../flow-data.js');
var tool    = require('../program-tool.js');
var etype   = require('../type-event.js');
var csv     = require('csv');
var fs      = require('fs');
var Iconv   = require('iconv').Iconv;

var __NAME          = 'etl-in-csv';
var TARGET_ENCODING = 'utf-8';
var AUTO_HEAD       = '1';
var TEST_ROW_LIMIE  = 100;


module.exports = {
  name          : "CSV 文件输入",
  groupName     : "输入",
  programID     : "__" + __NAME + "__",
  configPage    : __NAME + '.htm',
  className     : 1,
  icon          : __NAME + '.png',
  disable       : false,
  parent_max    : 0,
  child_max     : 1,

  checkConfig   : checkConfig,
  createConfig  : createConfig,
  run           : run
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.heads, cf.types);

  ch.mustStr('in_file', 1);
  ch.mustStr('encoding', 1);

  ch.mustArr('heads');
  ch.arrNotNul('heads');
  ch.arrNotRepeat('heads');

  ch.mustArr('types');

  for (var i = 0; i < cf.heads.length; ++i) {
    if (!cf.types[i]) {
      cf.types[i] = 'STRING';
    }
  }

  RCB(ch.getResult());
}


function createConfig(RCB) {
  var conf = {
    name      : 'CSV 文件输入',
    in_file   : '',
    has_head  : '1', // 1:自动, 2:手动
    encoding  : 'UTF-8',

    heads     : [],
    types     : []
  };

  RCB(null, conf);
}


function run(interactive, limit, is_test) {
  var root = interactive.getConfig();
  var conf = root.run_config;
  var send = flow.auto_data(limit);
  var line = -1;


  var reader = fs.createReadStream(conf.in_file);

  reader.on('error', function(err) {
    interactive.sendEvent(etype.ERROR, err);
  });


  var parser = csv.parse();

  parser.on('error', function(err) {
    interactive.sendEvent(etype.ERROR, err);
  });

  parser.on('end', function() {
    var msg = '读取数据 ' + send.totalrows() + ' 行';
    interactive.sendEvent(etype.STATISTICS, msg);
    interactive.sendEvent(etype.L_EX_ROWCOUNT, { 
          row_count: send.totalrows(), msg: conf.name });
    interactive.log(msg);
    interactive.runOver(send);
  });


  if (conf.has_head == AUTO_HEAD) {
    parser.once('data', function(heads) {
      send.setHead(heads);
      _reg_data_event();
    });
  } else {
    send.setHead(conf.heads);
    send.setType(conf.types);
    _reg_data_event();
  }

  function _reg_data_event() {
    if (!is_test) {
      parser.on('data', function(record) {
        send.push(record, ++line);
      });
    } else {
      var rcount = TEST_ROW_LIMIE;
      parser.on('data', function(record) {
        if (--rcount >= 0) {
          send.push(record, ++line);
        } else {
          reader.unpipe();
          parser.end();
        }
      });
    }
  }


  if (TARGET_ENCODING != conf.encoding) {
    var iconv = new Iconv(conf.encoding, TARGET_ENCODING);

    iconv.on('error', function(err) {
      interactive.sendEvent(etype.ERROR, err);
    });

    reader.pipe(iconv).pipe(parser);
  } else {
    reader.pipe(parser);
  }


  interactive.onStop(function() {
    reader.unpipe();
    parser.end();
  });

}
