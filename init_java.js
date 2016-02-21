var java    = require('java');
var jfact   = require('java-factory-lib');
var db3     = require('db3-lib');
var hl7     = require('hl7-lib');
var jms     = require('jms-lib');

jfact.loadjar(__dirname + '/jar/');
jfact.setJavaInstance(java);

db3.initJava(java);
hl7.initJava(java);
jms.initJava(java);