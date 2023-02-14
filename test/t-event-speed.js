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



console.log('begin');

// test1();
// test2();
test3();

console.log('over');


/*
test1 use on():
 10000    use time:    23 ms
 100000   use time:    48 ms
 1000000  use time:   271 ms
 10000000 use time:  2735 ms

test2 use once():
 10000    use time:     44 ms
 100000   use time:    221 ms
 1000000  use time:   2141 ms
 10000000 use time:  21349 ms

test2:
 10000    use time:    30 ms
 100000   use time:    64 ms
 1000000  use time:   408 ms
 10000000 use time:  3640 ms
//
*/
function test1() {
  var Event = require('events').EventEmitter;
  var e = new Event();
  var over = 10000000;
  var begin = Date.now();

  e.on("t", rcb);
  function rcb(a) {
    if (a==over) {
      console.log(over + " use time: ", Date.now() - begin, 'ms');
    }
    // e.once('t', rcb);
  }

  for (var i=0; i<=over; ++i) {
    e.emit('t', i);
  }
}


function test3() {
  var Event = require('events').EventEmitter;
  var e = new Event();
  e.sendEvent = e.emit;

  e.on('t', function() {
    throw new Error("err");
  });

  e.on('t', function() {
    console.log('ok');
  });

  e.on('error', function() {})
  e.on(null, function() {
    console.log('null event is support');
  })

  e.sendEvent(null);
  // e.emit('t');
}


function test2() {
  var _event_link = {};
  var e = {
    on: regEvent,
    emit: sendEvent,
  };

  function sendEvent(eventname, data) {
    if (!eventname) return;

    var queue = _event_link[eventname];
    if (queue && queue.length > 0) {
      var handle = queue.pop();
      return handle(data);
    }
  }

  function regEvent(eventname, eventHandle) {
    if (eventname && eventHandle) {
      var queue = _event_link[eventname];
      if (!queue) {
        queue = _event_link[eventname] = [];
      }
      queue.push(eventHandle);
    }
  }

  // begin
  var over = 10000000;
  var begin = Date.now();

  e.on("t", rcb);
  function rcb(a) {
    if (a==over) {
      console.log(over + " use time: ", Date.now() - begin, 'ms');
    }
    e.on("t", rcb);
  }

  for (var i=0; i<=over; ++i) {
    e.emit('t', i);
  }
}
