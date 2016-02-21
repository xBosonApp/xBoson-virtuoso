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