var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-buf';


var pg_cnf = {
  name       : "解析 Buffer 对象",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
};


function trans_fn(inval, rcb) {
  var buf = new Buffer(inval);
  rcb(null, buf.toString());
}


module.exports = tpl.template(pg_cnf, trans_fn);
