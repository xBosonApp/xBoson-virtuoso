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
var cluster  = require('cluster');


if (cluster.isMaster) {
  var worker = cluster.fork();
  worker.send({a:'hi there', fn:function() {}, err: new Error('err')});

  worker.on('message', function(msg) {
    console.log('@', msg);
  });

} else if (cluster.isWorker) {
  process.on('message', function(msg) {
    console.log(msg)
    process.send(msg);
  });
}