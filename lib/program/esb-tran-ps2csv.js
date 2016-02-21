var csv     = require('csv');
var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-ps2csv';


var pg_cnf = {
  name       : "解析 CSV 字符串",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
};


function trans_fn(inval, rcb) {
  csv.parse(inval, rcb);
}


module.exports = tpl.template(pg_cnf, trans_fn);
