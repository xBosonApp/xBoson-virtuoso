var fs      = require('hexo-fs');
var include = require('require-lib').requireReload;
var log     = require('logger-lib');
var path    = require('path');


module.exports.getProgramList = getProgramList;
module.exports.getProgram     = getProgram;
module.exports.initFactory    = initFactory;


var programCache = null;


function initFactory(over) {
	var file_id = {};
	programCache = {};

	var filedir = __dirname + '/program/';
	var requiredir = './program/';

	fs.listDir(filedir, function(err, files) {
		if (err) return over(err);

		files.forEach(function(file) {
			createProgram(file, true);
			watchfile(file);
		});
		
		over(null, programCache);
	});


	function createProgram(file, check_repeat) {
		try {
			var prog = include(requiredir + file);

			if (prog.disable == true) {
				log.debug("disable Promgram " + prog.programID);
				
				if (programCache[prog.programID]) {
					delete programCache[prog.programID];
				}
			}
			else if (prog.programID && prog.run) {

				if (check_repeat && programCache[prog.programID]) {
					throw new Error("程序冲突: " + prog.programID + ", in " + file);
				}
				
				programCache[prog.programID] = prog;
				file_id[filedir + file] = prog.programID;
				log.debug("create Promgram " + prog.programID);
			} 
			else {
				log.debug("is not Promgram " + file);
			}
		} catch(error) {
			log.debug('create Promgram get', error);
		}		
	}


	function watchfile(file) {
		fs.watch(filedir + file, function(err, watcher) {
			if (err) return log.err(err);
		
			watcher.on('change', function(f) {
      	createProgram(file);
      });

      watcher.on('unlink', function() {
      	log.debug('Promgram file remove', file);
      	var id = file_id[filedir + file];
      	delete programCache[id];
      	delete file_id[filedir + file];
      	watcher.close();
      });
		});
	}


	fs.watch(filedir, {recursive:true, persistent:true}, function(err, watcher) {
		if (err) {
			log.err(err);
			return;
		}

    if (!err) {
      watcher.on('add', function(f) {
      	var file = path.basename(f);
      	createProgram(file);
      	watchfile(file);
      });
    } else {
      log.error(err);
    }
  });
}


function programFactory(over) {
	if (programCache == null) {
		initFactory(over);
	} else {
		over(null, programCache);
	}
}


//
// 用 ID 取得程序的完整代码
//
function getProgram(programID, getter) {
	programFactory(function(err, prog) {
		if (err) return getter(err);

		if (!prog[programID]) {
			getter(new Error('program not exists ' + programID));
		}

		getter(null, prog[programID]);
	});
}


//
// 取得一个功能程序数组:
// {
// 	groupname: [ target, target ...]
// }
//
// target: {
// 	 name      : String
// 	 programID : String
//   // 用来修改这个程序配置的页面url, '/' == '/eeb/ui/'
//   configPage: String
//   // 图标, 基于 www/public/img/target-icon/ 目录
//   icon : String
// }
//
// getter: function(err, targetsArr);
//
function getProgramList(type, getter) {
	var ret = {};

	programFactory(function(err, programs) {
		if (err) return getter(err);

		for (var pid in programs) {
			var tg = programs[pid];

			if (!(tg.className & type) )
				continue;

			var group = ret[tg.groupName];
			if (!group) {
				group = ret[tg.groupName] = [];
			}

			group.push({
				name 					: tg.name,
				programID			: tg.programID,
				configPage  	: tg.configPage,
				icon 					: tg.icon,
				not_display 	: tg.not_display,
				group_program : tg.group_program
			});
		}
		getter(null, ret);
	});
}

