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
var jxml    = require('xson-lib');
var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-x2j';


var pg_cnf = module.exports = {
  name          : "解析 XML 字符串",
  programID     : "__" + __NAME + "__",
  icon          : __NAME + '.png',
};


function trans_fn(inval, rcb) {
  var outval = jxml.toJson(inval);
  // outval = JSON.parse(outval);
  rcb(null, outval);
}


module.exports = tpl.template(pg_cnf, trans_fn);