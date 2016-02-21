var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-en-b64';


var pg_cnf = {
  name       : "编码为 BASE64",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
};


function trans_fn(inval, rcb) {
  var buf = new Buffer(inval);
  rcb(null, buf.toString('base64'));
}


module.exports = tpl.template(pg_cnf, trans_fn);
