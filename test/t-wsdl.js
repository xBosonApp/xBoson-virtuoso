require('../init_java.js');

var soap = require('soap');
var logger = require("logger-lib")('wsdl');
//var h2 = require('../lib/h2-data.js');

createServer();


function createClient() {
  var url = 'http://bj.e-clic.cn/webServicesTest/services/nwsServices?wsdl';
  url = 'http://bj.e-clic.cn/webServicesTest/services/billServices?wsdl';
  url = 'http://www.w3schools.com/webservices/tempconvert.asmx?wsdl';
  url = 'http://localhost:8000/soap?wsdl';


  soap.createClient(url, function(err, client) {
    if (err) return console.log(err.message);

    console.log('describe:', JSON.stringify(client.describe()) );
    
    console.log(client.describe().MyService.MyPort.MyFunction);
    // console.log(client.services);

    try {
      client.MyFunction({ 'name':'call function', age: '1' }, function(err, result) {
        if (err) return console.log('err:', err.message);
        console.log('ok:', result);
      });
    } catch(err) {
      console.log('err`1: ', err);
    }

    // process.exit(0);
  });
}


function createServer() {
  var myService = {
        MyService: {
            MyPort: {
                MyFunction: function(args) {
                    return {
                        name: 'get ' + args.name + ', in MyFunction',
                        age: args.age + 10
                    };
                },

                // This is how to define an asynchronous function.
                MyAsyncFunction: function(args, callback) {
                    // do some work
                    callback({
                        name: args.name
                    })
                },

                // This is how to receive incoming headers
                HeadersAwareFunction: function(args, cb, headers) {
                    return {
                        name: headers.Token
                    };
                }
            }
        }
    }

  var http = require('http');
  var o2w = require('../lib/obj2wsdl.js');
  var name = '/soap';

  var opt = {
    url : 'http://localhost:8000' + name,
    services: { // 结构与 myService 一致
      MyService : {
        MyPort : {
          MyFunction : {
            'in'  : { name: 'xsd:string', age: 'xsd:decimal' }, 
            'out' : { name: 'string', age: 'xsd:decimal' }
          },
          MyAsyncFunction : {
            'in'  : { name: 'string' }, 
            'out' : { name: 'string' }
          }
        }
      }
    }
  };


  o2w.build_wsdl(myService, opt, function(err, xml) {
    console.log('o2w work')
    if (err) return console.log('!!', err);
    console.log('wsdl xml is build..', xml)

    server = http.createServer(function(request,response) {
      response.end("404: Not Found: "+request.url)
    });
    server.listen(8000);

    var soapserver = soap.listen(server, name, myService, xml);

    soapserver.log = function(type, data) {
      // console.log(Date.now(), type, data)
      logger.info(type, data);
    };


    // 与服务无关的代码
    // createClient();
  });
}