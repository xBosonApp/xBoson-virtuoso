var jxml    = require('xson-lib');
var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-x2j';


var pg_cnf = module.exports = {
  name          : "解析 XML 字符串",
  programID     : "__" + __NAME + "__",
  icon          : __NAME + '.png',
};


function trans_fn(inval, rcb) {
  var outval = jxml.toJson(inval);
  // outval = JSON.parse(outval);
  rcb(null, outval);
}


module.exports = tpl.template(pg_cnf, trans_fn);