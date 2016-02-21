var tool = require('../lib/program-tool.js');


var lk = tool.call_link();


lk.add(function(d, next) {
  console.log(1, d);
  next();
});


lk.add(function(d, next) {
  console.log(2, d);
  next();
});


var data = {'hello':'call link'};

lk(data, function(d) {
  console.log('last', d);
});