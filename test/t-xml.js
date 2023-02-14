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
// https://github.com/buglabs/node-xml2json
try {

var parser = require('xml2json');

var xml = "<foo>bar</foo>";
var opt = { reversible:true };
var json = parser.toJson(xml, opt); //returns a string containing the JSON structure by default

console.log(json.foo);

console.log( parser.toXml(json) );

} catch(err) {
  console.log('xml err:', err);
}