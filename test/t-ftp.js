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
var Client = require('ftp');
var fs = require('fs');

var c = new Client();

c.on('ready', function() {
  console.log('ready')
  c.get('foo.txt', function(err, stream) {
    if (err) throw err;
    stream.once('close', function() { c.end(); });
    stream.pipe(fs.createWriteStream('foo.local-copy.txt'));
  });
});

// connect to localhost:21 as anonymous
c.connect({
  host: '192.168.7.21',
  port: 22,
  user: 'zhirong',
  password: 'vzrlocalzr',
});