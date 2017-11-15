/**
 *  SmartThings Node Proxy (STNP)
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

////////////////////
// DO NOT CHANGE BELOW THIS LINE
////////////////////
var express = require('express');
var http = require('http');
var app = express();
var nconf = require('nconf');
var fs = require('fs');
var STL = require('smartthings-node-proxy-logger'); //STL - Smartthings Logger
var chokidar = require('chokidar');
nconf.file({ file: './config.json' });

const logger = new STL(__dirname,'stnp');

/**
 * Root route
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: 'SmartThings Node Proxy running' }).end();
});

app.get('/logs',function(req,res){
  const readstream = fs.createReadStream('general_log.txt',{autoclose:true});
  
  readstream.on('error',(err)=>{
    logger.log(err);
    res.status(404).send("general log file not found return to URL / and try again.").end()
    const writestream = fs.createWriteStream('general_log.txt',{autoclose:true})
  })

  readstream.on('readable',()=>{
    logger.log(null,"Logs were accessed")
    
  })
  readstream.pipe(res);

})

app.get('/errors',function(req,res){
  const readstream = fs.createReadStream('error_log.txt',{autoclose:true});
  readstream.on('error',(err)=>{
    logger.log(err);
    res.status(404).send("error log file not found return to URL / and try again.").end()
    const writestream = fs.createWriteStream('error_log.txt',{autoclose:true})
  })
  readstream.on('readable',()=>{
    logger.log(null,"Error Logs were accessed")
  })
     readstream.pipe(res);
})

app.get('/favicon.ico',function(req,res){
  //gets rid of favicon.ico Authentication error  Or add the favicon. and remove this path once favicon is added
  res.status(200).end()
})
/**
 * Enforce basic authentication route; verify that HTTP.HEADERS['stnp-auth'] == CONFIG['authCode']
 */
app.use(function (req, res, next) {
  logger.log(req.ip+' '+req.method+' '+req.url);

  var headers = req.headers;
  if (!headers['stnp-auth'] ||
    headers['stnp-auth'] != nconf.get('authCode')) {
    logger.log('Authentication error');
    res.status(500).json({ error: 'Authentication error' });
    return;
  }

  next();
});

/**
 * Subscribe route used by SmartThings Hub to register for callback/notifications and write to config.json
 * @param {String} host - The SmartThings Hub IP address and port number
 */
app.get('/subscribe/:host', function (req, res) {
  var parts = req.params.host.split(":");
  nconf.set('notify:address', parts[0]);
  nconf.set('notify:port', parts[1]);
  nconf.save(function (err) {
    if (err) {
      logger.log('Configuration error: '+err.message);
      res.status(500).json({ error: 'Configuration error: '+err.message });
      return;
    }
  });
  res.end();
});

/**
 * Startup
 */
var server = app.listen(nconf.get('port') || 8080, function () {
  logger.log(null,'SmartThings Node Proxy listening at http://'+server.address().address+':'+server.address().port);
});

/**
 * Load all plugins
 */

fs.readdir('./plugins', function(err, files) {
  if (!err) {
    files
    .filter(function(file) { return file.substr(-3) === '.js'; })
    .forEach(function(file) {
      var plugin = file.split(".")[0];
      app.use('/plugins/'+plugin, require('./plugins/'+plugin)(function(data){notify(plugin,data);}));
      logger.log(null,'Loaded plugin: '+plugin);
    });
  } else {
    logger.log(err);
  }
});

/**
 * Callback to the SmartThings Hub via HTTP NOTIFY
 * @param {String} plugin - The name of the STNP plugin
 * @param {String} data - The HTTP message body
 */
var notify = function(plugin, data) {
  if (!nconf.get('notify:address') || nconf.get('notify:address').length == 0 ||
    !nconf.get('notify:port') || nconf.get('notify:port') == 0) {
    logger.log("Notify server address and port not set!");
    return;
  }

  var opts = {
    method: 'NOTIFY',
    host: nconf.get('notify:address'),
    port: nconf.get('notify:port'),
    path: '/notify',
    headers: {
      'CONTENT-TYPE': 'application/json',
      'CONTENT-LENGTH': Buffer.byteLength(data),
      'stnp-plugin': plugin
    }
  };

  var req = http.request(opts);
  req.on('error', function(err, req, res) {
    logger.log("Notify error: "+err);
  });
  req.write(data);
  req.end();
}
