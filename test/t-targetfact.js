var tf = require('../lib/program-factory.js');

// setInterval(function() {

tf.getProgramList(1, function(err, tagets) {
	console.log(err, tagets)
});

// }, 2000);