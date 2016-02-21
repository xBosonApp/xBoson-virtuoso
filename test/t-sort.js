var qsort = require('./quicksort.js');
var tlib  = require('./t-lib.js');
var flow  = require('../lib/flow-data.js');
var msort = require('../lib/j-quicksort.js');
var sort  = require('../lib/sort.js').sort;

var show_flow = tlib.show_flow;
var showarr = tlib.showarr;

/*
sort.js Use memory :
Total 99 data, use 16 ms
Total 999 data, use 156 ms
Total 9999 data, use 13625 ms

sort.js Use file :
Total 99 data, use 16 ms
Total 999 data, use 156 ms
Total 9999 data, use 13531 ms
*/


var use_file = 0;

_test(9999+1);
// _test(15000);
// native_sort();
// test_quick_sort();


function native_sort() {
  var showEnd = tt();
  var c = 99999;
  var a = [];

  for (var i=0; i<c; ++i) {
    a[i] = Math.random()*10000;
  }

  // 原生数组排序
  // Total 10000000 data, use 108095 ms
  //a.sort();

  // 快速排序算法, 未修改
  // Total 10000000 data, use 6531 ms
  // Total 100000 data, use 110 ms
  // qsort.sort(a);
  // showEnd();

  // 快速排序算法, 修改为异步操作
  // Total 10000000 data, use 17043 ms
  msort.sort(a, null, function() {
    showEnd(c);
  });
}


function test_quick_sort() {
  var c = 15000;
  var a = [7,1,4,9,8, 6,0,2,3,5];
  var index = [];
  var end = tt();

  for (var i=0; i<c; ++i) {
    a[i] = Math.random()*10000;
    index[i] = i;
  }


  var b = a.slice(0);
  qsort.sort(a);
  a.length < 100 && console.log('a',a);
  a.length < 100 && console.log('b',b);


  // ---------------------------------------------------------
  msort.sort(index, function(i,j) {
    return b[i] - b[j];
  }, end_sort);


  function end_sort(index) {
    var newb = [];
    for (var i=0; i<b.length; ++i) {
      newb[i] = b[ index[i] ];
    }

    a.length < 100 &&  console.log('n',newb);
    a.length < 100 &&  console.log('i',index)
    _check(newb);
  }
  // ---------------------------------------------------------

  function _check(b) {
    for (var i=0; i<a.length; ++i) {
      if (a[i] != b[i]) {
        console.log('BAD !!! sort not work');
        end(c);
        return;
      }
    }

    console.log('GOOD !!! sort work', a.length);
    end(c);
  }
}


function _test(total) {
  var d = use_file ? flow.file_data() : flow.mem_data(); 
  var end = tt('Create');


  d.setHead(['a', 'b']);
  d.setType(['i', 'i']);

  for (var i=total/3; i>0; --i) {
    d.push([i, (Math.random()*i).toFixed(2)]);
    d.push([i, (Math.random()*i).toFixed(2)]);
    d.push([i, (Math.random()*i).toFixed(2)]);
  }

  end(total);
  end = tt('Sort');

  // 原先的左右排序
  // Total 9999 data, use 13533 ms
  // sort(d, sort_fn, ret);

  // 快速排序
  // Total 9999 data, use 94 ms
  // Sort 99999 data, use 31732 ms
  sort(d, sort_fn, ret);  


  function ret(r) {
    end(total);

    if (r.totalrows() < 100) {
      // console.log(d.toString(), r.totalrows());
      show_flow(r);
    }
    if (total < 1000000) {
      // _test(total * 10 + 9);
    }
    d.reset();
  }
}


function sort_fn(a, b) {
  // console.log('!',a, b);
  var p = a[0] - b[0];
  if (p == 0) {
    p = a[1] - b[1];
  }
  return p;
}


function tt(msg) {
  var begin = Date.now();

  if (!msg) msg = "Total";

  var tid = setInterval(function() {
    console.log('thread not stop', new Date());
  }, 1000);

  return function(t) {
    console.log(msg, t, 'data, use', Date.now() - begin, 'ms');
    clearInterval(tid);
  }
}
