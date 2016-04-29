var tpl     = require('../esb-tran-template.js');
var __NAME  = 'esb-tran-json2txt';


var pg_cnf = {
  name       : "还原为 JSON 字符串",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
};


function trans_fn(inval, rcb) {
  var outval = JSON.stringify(inval);
  rcb(null, outval);
}


module.exports = tpl.template(pg_cnf, trans_fn);
