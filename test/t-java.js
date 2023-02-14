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
require('../init_java.js');

var h2 = require('../lib/h2-data');
var java = require('java-factory-lib').getJavaInstance();


var DocumentBuilderFactory
            = java.import('javax.xml.parsers.DocumentBuilderFactory');

try {
  h2.log('', {}, {})
} catch(err) {
  console.log(err)
}

var docFactory  = DocumentBuilderFactory.newInstance(function(err, docFactory) {
  docFactory.newDocumentBuilder(function(err, docBuilder) {
    docBuilder.newDocument(function(err, doc) {
      doc.toString(function(err, str) {
        console.log(err || str);
        process.exit(0)
      });
    });
  });
});

