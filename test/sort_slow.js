var flow = require('./flow-data.js');
var tool = require('./program-tool.js');


module.exports.sort = sort;

var IS_SELF = {};


//
// 这个算法会占用很多内存/文件, 但不会让内存溢出
// 即使处理一个很大的数组也不会阻塞进程
//
// arr -- flow 数组
// sortbyfn -- Function(data1, data2) 比较两个数组返回 -1/0/1
// returnfn -- Function(return_data) 返回结果
// running  -- { run: true } 如果设置为 false 则停止运行, 可选的参数
// _is_self -- 递归调用时设置为 IS_SELF, 会清除临时数据
//
function sort(arr, sortbyfn, returnfn, running, _is_self) {

  if (!arr.has()) 
    return returnfn(arr);

  arr.next();

  var left  = arr.clone();
  var right = arr.clone();
  var pivot = arr.getData();

  if (!running) {
    running = { run: true };
  }

  var loop = tool.task_dispatch(_loop, true);


  function _loop() {
    if (running.run && arr.has()) {

      arr.next();
      var d = arr.getData();

      if (sortbyfn(d, pivot) < 0) {
        left.push(d);
      } else {
        right.push(d);
      }
      loop();

    } else {

      if (_is_self === IS_SELF) {
        arr.reset();
      }

      sort(left, sortbyfn, function(ret1) {
        sort(right, sortbyfn, function(ret2) {
          concat(ret1, pivot, ret2, returnfn, running);
        }, running, IS_SELF);
      }, running, IS_SELF);

    }
  }
}


function concat(arr1, item, arr2, returnfn, running) {
  arr1.push(item);
  arr2.moveto(0);

  var loop = tool.task_dispatch(_loop, true);


  function _loop() {
    if (running.run && arr2.has()) {
      arr2.next();
      arr1.push(arr2.getData());
      loop();

    } else {
      arr2.reset();
      arr1.moveto(0);
      returnfn(arr1);
    }
  }
}