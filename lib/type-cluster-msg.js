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
//
// 进程间通讯时, 发送的消息中有 type 属性, 使用这个属性区分消息类型
//
var type = {
  LOG          : 100,
  CORE_MSG     : 200,
  USE_PORT     : 300,
  FREE_PORT    : 301,
  USE_PORT_RET : 302,
};

module.exports = type;