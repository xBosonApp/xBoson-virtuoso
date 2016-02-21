
//
// 当 exit 方法被触发的时候, 等待所有挂起的操作都返回后才退出进程
// 这是一个全局对象, 进程引用则有效
//
module.exports = {
  wait : wait,
  exit : exit,
  printWork : printWork,
};


var uid = 1001;
var worker_stack = {};
var worker_count = 0;
var is_exit = false;
var code;


//
// 挂起一个等待任务, 返回一个释放函数,
//
function wait() {
  var id = uid++;
  worker_stack[id] = new Error('work ' + id).stack;

  ++worker_count;

  return function() {
    delete worker_stack[id];
    _release();
  };
}


//
// 打印挂起任务的堆栈信息
//
function printWork() {
  var c = 0;
  for (var n in worker_stack) {
    console.log('@### work id', n, worker_stack[n]);
    ++c;
  }
  if (c>0) {
    console.log('>>>> work count', c);
  }
}


//
// 释放一个挂起的任务, 并检查是否应该退出
//
function _release() {
  --worker_count;
  _do_exit();
}


function exit(_code) {
  is_exit = true;
  code    = _code;
  _do_exit();
}


function _do_exit() {
  if (!is_exit) return;
  if (worker_count > 0) return;

  setImmediate(function() {
    process.exit(code || 0);
  });
}