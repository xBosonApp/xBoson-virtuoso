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
var tpl     = require('../esb-tran-template.js');
var checker = require('../checker.js');
var tool    = require('../program-tool.js');
var Iconv   = require('iconv').Iconv;


var __NAME  = 'esb-tran-txt-code';


var pg_cnf = {
  name       : "字符串编码转换",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
  configPage : __NAME + '.htm',

  checkConfig   : checkConfig,
  createConfig  : createConfig,
};


function createConfig(RCB) {
  RCB(null, {
    name    : pg_cnf.name,
    fin     : '',
    fout    : '',
    outtype : 'b',

    codein  : 'UTF-8',
    codeout : 'UTF-8',

    bizlog  : {
      err : {
        desc   : '当数据转换失败时, 写错误日志',
        msg    : '失败',
        enable : false,
      }
    }
  });
}


function checkConfig(cf, RCB) {
  var ch = checker(cf);

  ch.mustStr('fin',  1, 99);
  ch.mustStr('fout', 1, 99);
  ch.mustStr('codein',  1);
  ch.mustStr('codeout', 1);

  RCB(ch.getResult());
}


function trans_fn(inval, rcb, cf) {
  if (cf.codein != cf.codeout) {
    var iconv = new Iconv(cf.codein, cf.codeout);
    var outval = iconv.convert(inval);

    if (cf.outtype == 't') {
      outval = outval.toString();
    }

    rcb(null, outval);
  } else {
    rcb(null, inval);
  }
}


module.exports = tpl.template(pg_cnf, trans_fn);