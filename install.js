// require('./init_java.js');
var clib = require('configuration-lib');

clib.wait_init(function() {


var conf = clib.load();
var localfile = conf.eeb_zy.local_db_dir;

var dirs = [
  localfile,
  localfile + '/logs',
  localfile + '/flow_data',

  localfile + '/file_pool',
  localfile + '/file_pool/$all',
  localfile + '/file_pool/$fix',

  // localfile + '/details',
  // localfile + '/statistics',
  localfile + '/eeb_config',

  localfile + '/eeb_config/ETL',
  localfile + '/eeb_config/ESB',
  localfile + '/eeb_config/BPM'
];

dirs.forEach(clib.mkdir);

var iid = require('./lib/instanceid.js');
iid.get(function(err, id) {
  console.log('instance id', err || 'success');
  console.log('ZY User name:', iid.getUserName());
});


});