var cluster  = require('cluster');


if (cluster.isMaster) {
  var worker = cluster.fork();
  worker.send({a:'hi there', fn:function() {}, err: new Error('err')});

  worker.on('message', function(msg) {
    console.log('@', msg);
  });

} else if (cluster.isWorker) {
  process.on('message', function(msg) {
    console.log(msg)
    process.send(msg);
  });
}