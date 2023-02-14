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
var tool = require('../lib/program-tool.js');


var lk = tool.call_link();


lk.add(function(d, next) {
  console.log(1, d);
  next();
});


lk.add(function(d, next) {
  console.log(2, d);
  next();
});


var data = {'hello':'call link'};

lk(data, function(d) {
  console.log('last', d);
});