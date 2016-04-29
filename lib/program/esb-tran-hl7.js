var tpl     = require('../esb-tran-template.js');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var hl7lib  = require('hl7-lib');


var __NAME  = 'esb-tran-hl7';
var _HL7    = 1;
var _XML    = 2;
var _JSON   = 3;


//
// hl7 中的消息不应该包含 LLD 的底层控制字节
//
var pg_cnf = {
  name       : "解析 HL7 消息",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
  configPage : __NAME + '.htm',

  checkConfig   : checkConfig,
  createConfig  : createConfig,
};


function createConfig(RCB) {
  RCB(null, {
    name   : pg_cnf.name,
    fin    : '',
    fout   : '',
    tin    : '1',
    tout   : '2',

    ask_type : [],
    ask_var  : [],
  });
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  tool.zip_arr(cf.ask_type, cf.ask_var);

  ch.mustArr('ask_type');
  ch.arrNotRepeat('ask_type');
  ch.arrNotNul('ask_type');

  ch.mustArr('ask_var');
  ch.arrNotRepeat('ask_var');
  ch.arrNotNul('ask_var');

  ch.mustStr('fin',  1, 99);
  ch.mustStr('fout', 1, 99);
  ch.mustNum('tin',  1, 4);
  ch.mustNum('tout', 1, 4);

  if (cf.tin == cf.cout) {
    ch.push('message', '输入与输出格式不能相同');
  }

  RCB(ch.getResult());
}


function trans_fn(inval, rcb, conf) {
  var dat7;

  if (inval.constructor !== String) {
    return rcb(new Error('in var must string'));
  }

  switch (parseInt(conf.tin)) {
    case _HL7:
      dat7 = hl7lib.parseHl7(inval);
      break;
    case _XML:
      dat7 = hl7lib.parseXml(inval);
      break;
    case _JSON:
      dat7 = hl7lib.parseJson(inval);
      break;
    default:
      throw new Error('不支持的输入格式:' + conf.tin);
  }

  var outv = {
    content : null,
    type    : null,
    ask     : {},
  };

  switch (parseInt(conf.tout)) {
    case _HL7:
      outv.content = dat7.toHl7();
      outv.type = 'HL7';
      break;
    case _XML:
      outv.content = dat7.toXml();
      outv.type = 'XML';
      break;
    case _JSON:
      outv.content = dat7.toJson();
      outv.type = 'JSON';
      break;
    default:
      throw new Error('不支持的输出格式:' + conf.tout);
  }

  for (var i=0, e=conf.ask_type.length; i<e; ++i) {
    outv.ask[ conf.ask_var[i] ] = dat7.ask( conf.ask_type[i] );
  }

  rcb(null, outv);
}


module.exports = tpl.template(pg_cnf, trans_fn);
