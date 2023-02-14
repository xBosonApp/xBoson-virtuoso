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
var tpl     = require('../esb-tran-template.js');


var __NAME  = 'esb-tran-en-b64';


var pg_cnf = {
  name       : "编码为 BASE64",
  icon       : __NAME + '.png',
  programID  : "__" + __NAME + "__",
};


function trans_fn(inval, rcb) {
  var buf = new Buffer(inval);
  rcb(null, buf.toString('base64'));
}


module.exports = tpl.template(pg_cnf, trans_fn);
