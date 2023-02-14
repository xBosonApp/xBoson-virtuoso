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
var net     = require('net');
var cluster = require('cluster');
var http    = require('http');

//
// 实验失败
//
if (cluster.isMaster) {

  var server = net.createServer();
  var id = 1;
  server.listen(800);
  console.log('server listening ...')

  server.on('connection', function(conn) {

    var __id = id++;
    console.log('new conn', __id);
    var worker = cluster.fork();

    worker.on('exit', function(code, signal) {
      console.log('exit', __id);
    });

    worker.send({
      id : __id
    }, conn);
  });

  http.request('http://localhost:800/a/b/c', function(resp) {
    console.log('request ok');
  });

} else {

  var hserver = http.createServer();

  hserver.on('request', function(req, resp) {
    console.log('work new conn');
    req.end('work ok!!', function() {
      hserver.close();
    });
  });

  hserver.on('close', function() {
    process.exit(0);
  });

  process.on('message', function(msg, socket) {
    console.log('work msg', msg);
    hserver.listen(socket, function(err) {
      console.log('listen ok', err)
    });
  });
}