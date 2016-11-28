/**
 *  Generic Plugin
 *
 *  Author: redloro@gmail.com
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 */
var express = require('express');
var app = express();
var nconf = require('nconf');
var notify;
var logger = function(str) {
  mod = 'gnrc';
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: 'Generic plugin running' });
});

app.get('/button1/:cmd', function (req, res) {
  plugin.button1(req.params.cmd);
  res.end();
});

module.exports = function(f) {
  notify = f;
  return app;
};

/**
 * Plugin
 */
var plugin = new Plugin();
plugin.init();

function Plugin() {
  /**
   * init (REQUIRED)
   */
  this.init = function() {
    logger('Doing something interesting during init...');
    return;
  };

  /**
   * Button1
   */
  this.button1 = function(cmd) {
    // Send command back to SmartThings Hub
    var data = {type: 'command', deviceId: '1', command: cmd};
    notify(JSON.stringify(data));
    logger(JSON.stringify(data));
  };

}
