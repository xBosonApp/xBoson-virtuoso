var id = require('../lib/instanceid.js');

id.get(function(err, id) {
  console.log('instanceid:', err || id);
});