var tool = require('./program-tool.js');


//
// QuickSort optimized
// look at: http://www.sourcecodesworld.com/articles/java
//              /java-data-structures/Optimizing_Quicksort.asp
// minimal edited by Johannes Boyne
//
// modify by J.yanming 2015
// support `fn`
//
// 排序 c 本身, 异步调用, 不会阻塞线程
// 如果待排序数据中有 null 值, 会导致排序无法结束!
// fn  -- 排序算法, Function(a,b) 返回 -1,0,1
// rcb -- Function(c) 排序结束
//
module.exports.sort = function (c, fn, rcb) {

  var i,j,
    left = 0,
    right= c.length-1,
    stack_pointer = -1;

  var stack = [],
    swap, temp,
    median;

  if (!fn) fn = function(a, b) {
    return a - b;
  };

  var loop        = tool.task_dispatch(_loop, true);
  var sub7_loop   = tool.task_dispatch(_sub7_loop);
  var sub_ij_loop = tool.task_dispatch(_sub_ij_loop);

    
  function _sub7_loop() {
    if (j<=right) {

      swap = c[j];
      i = j-1;

      while(i>=left && /* c[i] > swap */ fn(c[i], swap) > 0)
        c[i+1] = c[i--];

      c[i+1] = swap;
      ++j;

      //
      // 循环自己
      //
      sub7_loop();

    } else {
      //
      // 在这里返回
      //
      if(stack_pointer == -1) {
        return rcb(c);
      }

      right = stack[stack_pointer--];
      left  = stack[stack_pointer--];
      //
      // 重新进入主循环
      //
      loop();
    }
  }


  function _sub_ij_loop() {
    do { i++; } while(/* c[i] < temp */ fn(c[i], temp) < 0);
    do { j--; } while(/* c[j] > temp */ fn(c[j], temp) > 0);

    if(j < i) {
      //
      // 结束循环
      //
      return _sub_ij_end();
    }

    swap = c[i]; 
    c[i] = c[j]; 
    c[j] = swap;

    //
    // 循环自己
    //
    sub_ij_loop();
  }


  function _sub_ij_end() {
    c[left + 1] = c[j];
    c[j] = temp;
    
    if (right-i+1 >= j-left) {
      stack[++stack_pointer] = i;
      stack[++stack_pointer] = right;
      right = j-1;

    } else {

      stack[++stack_pointer] = left;
      stack[++stack_pointer] = j-1;
      left = i;
    }

    //
    // 重新进入主循环
    //
    loop();
  }


  function _loop() {
    if (right - left <= 7) {
      
      j=left+1;

      //
      // 进入子循环
      //
      sub7_loop();

    } else {

      median = (left + right) >> 1;
      i = left + 1;
      j = right;
      swap = c[median]; c[median] = c[i]; c[i] = swap;

      /* make sure: c[left] <= c[left+1] <= c[right] */

      if (/* c[left] > c[right] */ fn(c[left], c[right]) > 0){
        swap      = c[left]; 
        c[left]   = c[right]; 
        c[right]  = swap;

      } if (/* c[i] > c[right] */ fn(c[i], c[right]) > 0) {
        swap      = c[i];
        c[i]      = c[right]; 
        c[right]  = swap;

      } if (/* c[left] > c[i] */ fn(c[left], c[i]) > 0) {
        swap      = c[left]; 
        c[left]   = c[i]; 
        c[i]      = swap;
      }

      temp = c[i];

      //
      // 进入子循环
      // 
      sub_ij_loop();
    }

  } // END _loop

}
