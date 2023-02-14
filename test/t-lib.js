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


module.exports = {
  show_flow : show_flow,
  showarr   : showarr
};


function show_flow(f, beginAt) {
  var head = f.getHead();
  var rownum = 0;

  f.moveto(beginAt || 0);

  showarr('head', f.getHead(), 'LINE');
  showarr('type', f.getType(), 'EXT ATTR');

  while (f.has()) {
    f.next();
    var row = f.getData();
    showarr(rownum++, row, row.line);
  }
  console.log();
}


function showarr(name, arr, ext) {
  var txt = [];
  for (var i=0; i<arr.length; ++i) {
    txt.push(arr[i]);
  }
  console.log(''+name, "::", txt.join("\t"), "\t ", ext);
}