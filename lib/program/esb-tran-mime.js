var mime    = require('mime');
var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-mime';


var pg_cnf = {
  name       : "解析 MIME-TYPE",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
};


function trans_fn(inval, rcb) {
  var outval = mime.lookup(inval);
  rcb(null, outval);
}


module.exports = tpl.template(pg_cnf, trans_fn);
