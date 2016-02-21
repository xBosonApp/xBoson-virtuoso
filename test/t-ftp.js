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