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

