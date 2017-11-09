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
var chokidar = require('chokidar')
nconf.file({ file: './config.json' });

var logFileWatcher = null; 

function fileWatchComponent(){

//chose fs.watchFile() over fs.watch() incase the system is not windows or MacOS... Maybe its a RasberryPi

  if(!logFileWatcher){
    logFileWatcher = chokidar.watch(['general_log.txt','error_log.txt']);
    logFileWatcher.on('change',(path,stats)=>{
      if(nconf.get('maxLogSizeBytes') < stats.size)reduceLogSize(path);
    })
  }
}
function reduceLogSize (path){
  const tempwritestream = fs.createWriteStream('temp_'+path); //create a temp file so we don't mess with the one we are replacing. it's currently being used by readstream.
  const readstream = fs.createReadStream(path);
  readstream.on('readable',()=>{
    let chunk;
    let chunks;
    let lognotice;
    while (null !== (chunk = readstream.read(10))) {
      chunks = chunks + chunk;
      //check to see if the lenght of bytes that we have read so far is near the end of the file. If it is we will write to the temp file.
      if(chunks.length > (nconf.get('maxLogSizeBytes') - 400) && !lognotice){
        //put a line at the top of the file to show it was reduced
        lognotice = 'The log was reduced in size and restarted a new one at this point. \r\n'
        //convert the sring to a buffer
        let stringBuff = Buffer.from(lognotice);
        //write to the temp file. 
        tempwritestream.write(stringBuff);
        tempwritestream.write(chunk);
      }else if(chunks.length > (nconf.get('maxLogSizeBytes') - 400 ) && chunk.length >= 10){ //we've already indicated the truncated location now write the remaining data from the old file.
        tempwritestream.write(chunk)
      }else if(chunk.length < 10){ // this is here because at the end of the stream you'll end up with less than 10 bytes of data and so we want to write remaining data to the stream.
        tempwritestream.write(chunk)
        tempwritestream.end();
      }
    }
    //close the write stream so we can read from it.
    
  })

  //listen for when we're done with the file that we want to replace, this will fire when the readable event has no more data.
  readstream.on('close',()=>{
    const writestream = fs.createWriteStream(path);
    const tempreadstream = fs.createReadStream('temp_'+path);

    tempreadstream.pipe(writestream);

    writestream.on('close',()=>{
      fs.unlink('temp_'+path) //delete the temporary file
    });

  })

} 

var logger = function(err,str) {
  const mod = 'stnp';
  const logTimeStamp = new Date().toISOString();
  const opts = {
      flags : 'a',
      autoclose: true
    }
  if(err){
    var errorString = 'looks like an error message wasn\'t written into the system for this error';
    if(typeof err === 'object'){
      //check if the error is coming from non existent file
      if(err.code === 'ENOENT' && err.syscall && err.path){
        errorString = "Error: "+ err.code + ": " +"no such file or directory, "+ err.syscall + " "+err.path;
      }else{
        //if not an error we were looking for still log the error object.
        errorString = JSON.stringify(err);  
      }
    }else{
      // We're assuming this is a custom string error that was coded in the original logger.
      errorString = err;
    }
    writestream = fs.createWriteStream('error_log.txt',opts);
    writestream.open();
    writestream.write(logTimeStamp + ': [' + mod + '] ');
    writestream.write(errorString);
    writestream.end('\r\n');

  }else{
    writestream = fs.createWriteStream('general_log.txt',opts);
    writestream.open();
    writestream.write(logTimeStamp + ': [' + mod + '] '+str);
    writestream.end('\r\n');
  }

  fileWatchComponent()
  //hid the old logger since it was just loging to system and we wanted a file to send back to the end point
  //console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Root route
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: 'SmartThings Node Proxy running' }).end();
});

app.get('/logs',function(req,res){
  const readstream = fs.createReadStream('general_log.txt',{autoclose:true});
  
  readstream.on('error',(err)=>{
    logger(err);
    res.status(404).send("general log file not found return to URL / and try again.").end()
    const writestream = fs.createWriteStream('general_log.txt',{autoclose:true})
  })

  readstream.on('readable',()=>{
    logger(null,"Logs were accessed")
    
  })
  readstream.pipe(res);

})

app.get('/errors',function(req,res){
  const readstream = fs.createReadStream('error_log.txt',{autoclose:true});
  readstream.on('error',(err)=>{
    logger(err);
    res.status(404).send("error log file not found return to URL / and try again.").end()
    const writestream = fs.createWriteStream('error_log.txt',{autoclose:true})
  })
  readstream.on('readable',()=>{
    logger(null,"Error Logs were accessed")
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
  logger(req.ip+' '+req.method+' '+req.url);

  var headers = req.headers;
  if (!headers['stnp-auth'] ||
    headers['stnp-auth'] != nconf.get('authCode')) {
    logger('Authentication error');
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
      logger('Configuration error: '+err.message);
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
  logger(null,'SmartThings Node Proxy listening at http://'+server.address().address+':'+server.address().port);
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
      logger(null,'Loaded plugin: '+plugin);
    });
  } else {
    logger(err);
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
    logger("Notify server address and port not set!");
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
    logger("Notify error: "+err);
  });
  req.write(data);
  req.end();
}
