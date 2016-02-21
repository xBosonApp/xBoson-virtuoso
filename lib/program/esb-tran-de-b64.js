var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-de-b64';


var pg_cnf = {
  name       : "解析 BASE64",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
};


function trans_fn(inval, rcb) {
  var buf = new Buffer(inval, 'base64');
  rcb(null, buf);
}


module.exports = tpl.template(pg_cnf, trans_fn);
