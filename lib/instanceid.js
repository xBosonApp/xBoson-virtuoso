/**
 *  Copyright 2023 Jing Yanming
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
var uuid  = require('uuid-zy-lib');
var fs    = require('fs');
var pt    = require('path');
var conf  = require('configuration-lib').load();

var configdir = conf.eeb_zy.local_db_dir + '/';
var idfile    = configdir + 'instanceid.json';
var userfile  = configdir + 'login_user.txt';

var cacheid = null;


module.exports = {
  get         : get,
  getnodeid   : getnodeid,
  getUserName : getUserName,
};


//
// 返回节点 id
//
function getnodeid(rcb) {
  get(function(err, all) {
    if (err) return rcb(err);
    rcb(null, all.NODE);
  });
}


//
// 返回所有类型的实例 ID
// rcb -- Function(err, id)
//
function get(rcb, clear_cache) {
  if (clear_cache) {
    cacheid = null;
  }
  else if (cacheid) {
    return rcb(null, cacheid);
  }

  fs.readFile(idfile, {encoding : 'utf8'}, function(err, f) {
    if (err) {
      return init(rcb);
    }
    try {
      cacheid = JSON.parse(f);
    } catch(err) {
      return init(rcb);
    }
    rcb(null, cacheid);
  });
}


function init(rcb) {
  var data = JSON.stringify({
    ETL  : uuid.v4(),
    ESB  : uuid.v4(),
    BPM  : uuid.v4(),
    NODE : uuid.v4(),
  });

  fs.writeFile(idfile, data, function(err) {
    if (err) return rcb(err);
    cacheid = data;
    rcb(null, cacheid);
  });
}


//
// 同步方法
//
function getUserName() {
  var uname;
  try {
    uname = fs.readFileSync(userfile, "utf8");
  } catch(err) {
    uname = 'input_user_name_here';
    fs.writeFileSync(userfile, uname);
  }
  uname = uname.trim();

  return uname;
}