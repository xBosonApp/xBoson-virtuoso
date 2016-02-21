var flow  = require('./flow-data.js');
var tool  = require('./program-tool.js');
var qsort = require('./j-quicksort.js').sort;


module.exports.sort = sort;

var IS_SELF = {};


//
// 要比 sort.js 快 !
//
// arr      -- flow 数组
// sortbyfn -- Function(data1, data2) 比较两个数组返回 -1/0/1
// returnfn -- Function(return_data) 返回结果
// running  -- { run: true } 如果设置为 false 则停止运行, 可选的参数
//
function sort(arr, sortbyfn, returnfn, running) {
  var total = arr.totalrows();
  var mid = [], i = -1;

  var _make_mid = tool.task_dispatch(make_mid, true);


  function make_mid() {
    if (++i < total) {
      mid[i] = i;
      _make_mid();

    } else {
      qsort(mid, sort_fn, sort_end);
    }
  }


  function sort_fn(a, b) {
    arr.moveto(a);
    arr.next();
    var ad = arr.getData();

    arr.moveto(b);
    arr.next();
    var bd = arr.getData();

    return sortbyfn(ad, bd);
  }


  function sort_end() {
    var retdata = flow.auto_data(total);
    arr.clone(retdata);

    i = -1;
    var _set_ret = tool.task_dispatch(set_ret, true);


    function set_ret() {
      if (++i < total) {

        arr.moveto(mid[i]);
        arr.next();
        var ad = arr.getData();
        retdata.push(ad);
        _set_ret();

      } else {

         returnfn(retdata);
      }
    }
  }  
}