var flow = require('../lib/flow-data.js');
var tlib = require('./t-lib.js');

var show_flow = tlib.show_flow;
var showarr = tlib.showarr;

/*
Use file :
Total 100 data, use 15 ms
Total 1000 data, use 63 ms
Total 10000 data, use 484 ms
Total 100000 data, use 4531 ms
Total 1000000 data, use 44176 ms

Use memory :
Total 100 data, use 0 ms
Total 1000 data, use 0 ms
Total 10000 data, use 15 ms
Total 100000 data, use 266 ms
Total 1000000 data, use 2813 ms

Use mix:
Total 100 data, use 0 ms
Total 1000 data, use 0 ms
Total 10000 data, use 31 ms, switch to file
Total 100000 data, use 4422 ms, switch to file
Total 1000000 data, use 44140 ms, switch to file
*/

var use_file = 0;

// _test(9);
// _test(99);
// _test(999);
_test(9999);
// _test(99999);    
// _test(999999);  
// _test(9999999);


function _test(_count) {
  var d = use_file ? flow.file_data() : flow.mem_data(); 
  var begin = Date.now();


  d.setHead(['a', 'b', 'c', 'd', 'e']);
  d.setType(['string', 'number', 'json', 'Date', 'Array']);

  for (var i=0; i<_count; ++i) {
    var s = [
      '['+i+']', 
      (Math.random()*i).toFixed(2),
      {a:1,b:2},
      new Date(),
      [1,2,3]
    ];
    // console.log('save',s);
    d.push(s, i);
  }

  console.log('>> Create', d.totalrows(), 'data, use', Date.now()-begin, 'ms');
  show_flow(d, _count-10);
  _copy(d);

  if (_count < 100) console.log(d.toString());
}


function _copy(src) {
  var begin = Date.now();
  var dec = use_file ? flow.file_data() : flow.mem_data();
  dec.setHead( src.getHead() );
  dec.setType( src.getType() );

  src.moveto(0);

  while (src.has()) {
    src.next();
    var row = src.getData();
    if (row.line % 3 == 0) {
      dec.push(row);
    }
  }

  console.log('>> Copy', dec.totalrows(), 'data, use', Date.now()-begin, 'ms');
  show_flow(dec, dec.totalrows()-10);
}