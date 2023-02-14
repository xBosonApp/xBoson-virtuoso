/**
 *  Copyright 2023 Jing Yanming
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
var uuid    = require('uuid-zy-lib');
var checker = require('./checker.js');
var tool    = require('./program-tool.js');
var etype   = require('./type-event.js');
var mime    = require('mime');


var __NAME  = 'esb-tran-template';


//
// 数据转换框架, 使用基本配置生成一个完整的目标程序
//
// target_config -- 程序配置, 需要 name, programID, icon
// trans_fn      -- 转换函数 Function(indata, rcb, run_config) rcb : Function(err, outdata)
//                  函数将 indata 转换后调用 rcb 回传给框架, 失败或抛出异常皆可
//
// return 返回完整的目标配置
//
module.exports.template = function(target_config, trans_fn) {

  if (!trans_fn) {
    throw new Error('must have `trans_fn`');
  }

  if (!target_config.programID) {
    throw new Error('must have `programID`');
  }

  var ret = {
    name          : "[未命名的转换]",
    groupName     : "数据转换",
    programID     : null,
    configPage    : __NAME + '.htm',
    className     : 2,
    icon          : __NAME + '.png',
    disable       : 0,
    parent_max    : 1,
    child_max     : 1,

    checkConfig   : checkConfig,
    createConfig  : createConfig,
    run           : run
  };


  for (var n in target_config) {
    ret[n] = target_config[n];
  }

  return ret;


  //
  // 如果重写这个方法, 需要遵循基本的属性, 如: fin, fout, name 必须有
  //
  function createConfig(RCB) {
    var cf = {
      name : ret.name,
      _program_name : ret.name,
      fin  : '',
      fout : '',

      bizlog : {
        err : {
          desc   : '当数据转换失败时, 写错误日志',
          msg    : '失败',
          enable : false,
        }
      }
    };
    RCB(null, cf);
  }


  function checkConfig(cf, RCB) {
    var ch = checker(cf);

    ch.mustStr('fin', 1, 128);
    ch.mustStr('fout', 1, 128);

    RCB(ch.getResult());
  }


  function run(interactive, limit) {
    var root = interactive.getConfig();
    var conf = root.run_config;
    var recv = interactive.getData();

    var expin  = tool.expression_complier(conf.fin,  true);
    var expout = tool.expression_complier(conf.fout, true);
    var data   = recv.getData();

    try {
      var inval  = expin.val(data);

      trans_fn(inval, function(err, outval) {
        if (err) {
          _over_return(err);
        } else {
          expout.val(data, outval);
          _over_return();
        }
      }, conf);

    } catch(err) {
      _over_return(err);
    }


    function _over_return(err) {
      if (err) {
        // console.log('ESB Template ERR:', err.message, err.stack);
        // expout.val(data, 'Error');
        // tool.esb_error(err, interactive, data);
        interactive.sendError(err, data);
        return;
      }
      recv.push(data);
      interactive.runOver(recv);
    }
  }
}
