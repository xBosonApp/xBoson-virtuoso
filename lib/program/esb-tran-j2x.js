var jxml    = require('xson-lib');
var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-j2x';


var pg_cnf = {
  name       : "还原为 XML 字符串",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
};


function trans_fn(inval, rcb) {
  var outval = jxml.toXml(inval);
  rcb(null, outval);
}


module.exports = tpl.template(pg_cnf, trans_fn);