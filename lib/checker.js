var logger = require('logger-lib')('eeb');


module.exports = checker;


//
// 专门用于验证属性
// 
// ! 注意 : ( 1 >= null ) == true
//
// check_obj  -- 要验证的数据
// msg_filter -- { 'field_name' : 'message' } 用于替换默认提示, 可空
// 
function checker(check_obj, msg_filter) {
  var msg = {};
  var errcount = 0;

  //
  // 字段必须是非空字符串
  //
  function mustStr(field_name, min, max, success_fn) {
    var a = getFieldVal(field_name);
    var l = a && a.length;

    if ((!a) && a !== 0) {
      push(field_name, "必须填写字符");
    }
    else if (l < min) {
      push(field_name, "长度必须大于" + min + "个字符");
    }
    else if (l >= max) {
      push(field_name, "长度必须小于" + max + "个字符");  
    } 
    else {
      success_fn && success_fn(a);
    }
  }

  //
  // 字段必须是数字, min, max 是可选的
  // 
  function mustNum(field_name, min, max, success_fn) {
    var a = getFieldVal(field_name);
    var ret = [];

    a   = Number(a);
    min = Number(min);
    max = Number(max);

    if (isNaN(a)) {
      ret.push("必须是数字");
    }
    else if (a < min) {
      ret.push("必须大于" + min);
    }
    else if (a >= max) {
      ret.push("必须小于" + max);
    }
    if (ret.length > 0) {
      push(field_name, ret.join(''));
    } else {
      success_fn && success_fn(a);
    }
  }

  //
  // 字段必须是是数组, min, max 是可选的
  //
  function mustArr(field_name, min, max, success_fn) {
    var a = getFieldVal(field_name);
    var l = a && a.length;

    if (a == null) {
      push(field_name, "必须是数组");
    }
    else if (l < min) {
      push(field_name, "必须大于" + min + "个元素"); 
    }
    else if (l >= max) {
      push(field_name, "必须小于" + max + "个元素");   
    }
    else {
      success_fn && success_fn(a);
    }
  }

  //
  // 字段必须是数组, 数组中的元素不能重复
  //
  function arrNotRepeat(field_name) {
    var f = getFieldVal(field_name);
    var rep = {};

    for (var i = 0; i < f.length; ++i) {
      if (rep[ f[i] ]) {
        push(field_name + '.' + i, "字段不能重复");
      } else {
        rep[ f[i] ] = true;
      }
    }
  }

  //
  // 字段必须是数组, 数组中的元素不能为空
  //
  function arrNotNul(field_name) {
    var f = getFieldVal(field_name);

    for (var i = 0; i < f.length; ++i) {
      if ((!f[i]) && isNaN(f[i])) {
        push(field_name + '.' + i, "必须填写");
      }
    }
  }

  //
  // 字段必须是数组, 数组中的元素必须是数字
  //
  function arrMustNum(field_name) {
    var f = getFieldVal(field_name);

    for (var i = 0; i < f.length; ++i) {
      if (isNaN(f[i]) || (!f[i])) {
        push(field_name + '.' + i, "必须填写数字");
      }
    }
  }

  //
  // 没有错误消息返回 null
  //
  function getResult() {
    if (errcount > 0) {
      return msg;
    } else {
      return null;
    }
  }

  //
  // 没有发生错误返回 true
  //
  function noError() {
    return errcount <= 0;
  }

  function getFieldVal(exp) {
    var as = exp.split('.');
    var o = check_obj;

    for (var i=0; i<as.length; ++i) {
      o = o[as[i]];
      if (!o) {
        break;
      }
    }

    return o;
  }

  //
  // 推入一条消息, 首先会应用 msg_filter 进行消息过滤
  //
  function push(_field_name, _msg) {
    if (msg_filter) {
      if (msg_filter[_field_name]) {
        _msg = msg_filter[_field_name];
      }
    }
    msg[_field_name] = _msg;
    ++errcount;
  }

  return {
    getResult     : getResult,
    noError       : noError,
    mustNum       : mustNum,
    mustStr       : mustStr,
    mustArr       : mustArr,
    push          : push,
    arrNotRepeat  : arrNotRepeat,
    arrMustNum    : arrMustNum,
    arrNotNul     : arrNotNul
  };
}