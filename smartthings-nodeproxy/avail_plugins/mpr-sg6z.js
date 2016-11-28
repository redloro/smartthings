/**
 *  Monoprice 6 Zone Home Audio Multizone Controller and Amplifier Plugin
 *
 *  Author: tcjennings@hotmail.com
 *
 *  Based on Russound RNET Plugin
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
 *
 *  Supported Commands:
 *   Zone On/Off state (0x00 = OFF or 0x01 = ON)
 *   Source selected 1 - 6
 *   Volume level (00 - 38, Display Range 00 - 38)
 *   Bass level (0 = -10 ... 7 = Flat ... 14 = +10)
 *   Treble level (0 = -10 ... 7 = Flat ... 14 = +10)
 *   Balance level (00 = More Left ... 10 = Center ... 20 = More Right) * No Keypad display for Balance
 *   Do Not Disturb state (00 = OFF, 01 = ON )
 *   Mute state (00 = OFF, 01 = ON )
 *   Keypad Connected Status (00 = NO, 01 = YES)
 *
 *  Note: The Zone must be ON or else commands for that zone will not be processed.
*/
var express = require('express');
var serialport = require("serialport");
var app = express();
var nconf = require('nconf');
nconf.file({ file: './config.json' });
var notify;
var logger = function(str) {
  mod = 'mpr6';
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json(mpr6z.check());
});
app.get('/discover', function (req, res) {
  mpr6z.discover();
  res.end();
});

/**
 * Parameter Getters
*/
app.get('/zones/:id/balance', function (req, res) {
  mpr6z.getZoneBalance(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/treble', function (req, res) {
  mpr6z.getZoneTreble(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/bass', function (req, res) {
  mpr6z.getZoneBass(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/volume', function (req, res) {
  mpr6z.getZoneVolume(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/mute', function (req, res) {
  mpr6z.getZoneMute(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/source', function (req, res) {
  mpr6z.getZoneSource(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/state', function (req, res) {
  mpr6z.getZoneState(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/dnd', function (req, res) {
  mpr6z.getZoneDoNotDisturb(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/keypad', function (req, res) {
  mpr6z.getZoneKeypad(Number(req.params.id));
  res.end();
});
app.get('/zones/:id/pa', function (req, res) {
  mpr6z.getZonePublicAddress(Number(req.params.id));
  res.end();
});
app.get('/zones/:id', function (req, res) {
  mpr6z.getZone(Number(req.params.id));
  res.end();
});

/**
 * Parameter Setters
*/
app.get('/zones/:id/balance/:balance', function (req, res) {
  mpr6z.setZoneBalance(Number(req.params.id), Number(req.params.balance));
  res.end();
});
app.get('/zones/:id/treble/:treble', function (req, res) {
  mpr6z.setZoneTreble(Number(req.params.id), Number(req.params.treble));
  res.end();
});
app.get('/zones/:id/bass/:bass', function (req, res) {
  mpr6z.setZoneBass(Number(req.params.id), Number(req.params.bass));
  res.end();
});
app.get('/zones/:id/volume/:volume', function (req, res) {
  mpr6z.setZoneVolume(Number(req.params.id), Number(req.params.volume));
  res.end();
});
app.get('/zones/:id/mute/:mute', function (req, res) {
  mpr6z.setZoneMute(Number(req.params.id), Number(req.params.mute));
  res.end();
});
app.get('/zones/:id/source/:source', function (req, res) {
  mpr6z.setZoneSource(Number(req.params.id), Number(req.params.source));
  res.end();
});
app.get('/zones/:id/state/:state', function (req, res) {
  mpr6z.setZoneState(Number(req.params.id), Number(req.params.state));
  res.end();
});
app.get('/zones/:id/dnd/:state', function (req, res) {
  mpr6z.setZoneDoNotDisturb(Number(req.params.id), Number(req.params.state));
  res.end();
});
app.get('/zones/:id/all/:state', function (req, res) {
  mpr6z.setAllZones(Number(req.params.state));
  res.end();
});

module.exports = function(f) {
  notify = f;
  return app;
};

/**
 * MPR6Z
 */
var mpr6z = new Mpr6z();
mpr6z.init();

function Mpr6z() {
  var self = this;
  var device = null;
  var buffer = new Array();
  var serialPorts = new Array();
  var controllerId = 0x00;

  /**
   * init
   */
  this.init = function() {
    getSerialPorts();

    if (!nconf.get('mpr6z:serialPort')) {
        logger('** NOTICE ** MPR6Z serial port not set in config file!');
        return;
    }

    if (device && device.isOpen()) { return };

    device = new serialport.SerialPort(nconf.get('mpr6z:serialPort'),
                                       { baudrate: nconf.get('mpr6z:baudRate'),
                                         parser: serialport.parsers.readline('\n')
                                        },
                                        false);

    device.on('data', function(data) {
		read(data);
    });

    device.open(function (error) {
      if (error) {
        logger('MPR6Z connection error: '+error);
        device = null;
        return;
      } else {
        logger('Connected to MPR6Z: '+nconf.get('mpr6z:serialPort'));
      }
    });
  };

  // check connection every 60 secs
  setInterval(function() { self.init(); }, 60*1000);

  /**
   * check
   */
  this.check = function() {
    if(!device) {
      return { status: 'Monoprice MPR6Z plugin offline', "serialPorts": serialPorts };
    }
    return { status: 'Monoprice MPR6Z plugin running' };
  };

  /**
   * write
   */
  function write(cmd) {
    if (!device || !device.isOpen()) {
      logger('MPR6Z not connected.');
      return;
    }

    if (!cmd || cmd.length == 0) { return; }
    //logger('TX > '+cmd);
     device.write(cmd, function(err, results) {
       if (err) logger('MPR6Z write error: '+err);
     });
  }

  this.command = function(cmd) {
    write(cmd);
  };

  /**
   * read
   * The MPR6Z has 2 different reply structures:
   *    >xxPPuu'CR' for reply to control order OR reply to inquiry(2)
   *    >xxaabbccddeeffgghhiijj'CR' for reply to inquiry(1)
   * After trim, data lengths for the responses are
   *  inquiry(1) == 24
   *  inquiry(2) == 8
   * Which includes a leading prompt ('#') character.
   */
  function read(data) {
  	data = data.trim()
  	//logger("data length : " + data.length);
    if (data.length == 0) { return; }
    //logger("data");
    //logger("====");
    //logger(data);

	if ( data.length == 8 ) {
     var code = getCommandCode(data);
    } else if ( data.length == 24) {
     var code = 'ALL';
    }
    if (!code) { return; }

    var response = RESPONSE_TYPES[code];
    if (!response) { return; }

    var matches = getMatches(data, response['pattern']);
    if (!matches) { return; }

    responseHandler = response['handler'];
    responseHandler(matches.map(Number));
  }

  /**
   * Discovery Handlers
   */
  this.discover = function() {
    if (nconf.get('mpr6z:controllerConfig')) {
      notify_handler(nconf.get('mpr6z:controllerConfig'));
      logger('Completed controller discovery');
    } else {
      logger('** NOTICE ** Controller configuration not set in config file!');
    }
    return;
  };

  /**
   * Generic Handlers
   */
  function zone_info(data) {
    z = (data[0]*10) + data[1]
    notify_handler({
      type: 'zone',
      controller: data[0],
      zone: z,
      pa: data[2],
      state: data[3],
      mute: data[4],
      doNotDisturb: data[5],
      volume: data[6],
      treble: data[7],
      bass: data[8],
      balance: data[9],
      source: data[10],
      sourceName: nconf.get('mpr6z:sources')[data[10]-1],
      keypad: data[11] });
  }
  this.getZone = function(id) {
    //this one wants to get all the things for a zone
    // inquiry '?xx\r' where xx is the zone #
    write('?' + id + '\r');
  };
   this.setAllZones = function(state) {
	   //MPR-6Z doesn't have an "all-off" or "all-on" function, but we can build one.
	   zones = nconf.get('mpr6z:controllerConfig')['zones'];
	   for(var i = 0; i < zones.length; i++)
	   {
   			this.setZoneState(zones[i]['zone'],state);
	   }
	   //I don't think I need this since each setZoneState sends its own notification
	   //notify_handler({type: 'zone', controller: 1, zone: -1, state: state});
   };

  function zone_state(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, state: data[2]});
  }
  this.getZoneState = function(id) {
    write('?' + id + "PR" + '\r');
  };
  this.setZoneState = function(id, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 1) { value = 1; }

    //Need to 0-pad number
    if ( value < 10 ) { value = "0" + value; };
    write('<' + id + 'PR' + value + '\r');

    this.getZoneState(id);
  };

  function zone_dnd(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, state: data[2]});
  }
  this.getZoneDoNotDisturb = function(id) {
    write('?' + id + "DT" + '\r');
  };
  this.setZoneDoNotDisturb = function(id, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 1) { value = 1; }

    //Need to 0-pad number
    if ( value < 10 ) { value = "0" + value; };
    write('<' + id + 'DT' + value + '\r');

    this.getZoneDoNotDisturb(id);
  };

  function zone_source(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, source: data[2], sourceName: nconf.get('mpr6z:sources')[data[2]-1]});
  }
  this.getZoneSource = function(id) {
    write('?' + id + "CH" + '\r');
  };
  this.setZoneSource = function(id, value) {
    if ( value < 1 ) { value = 1; }
    if ( value > 6) { value = 6; }

    //Need to 0-pad number
    if ( value < 10 ) { value = "0" + value; };
    write('<' + id + 'CH' + value + '\r');

    this.getZoneSource(id);
  };

  function zone_mute(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, mute: data[2]});
  }
  this.getZoneMute = function(id) {
    write('?' + id + "MU" + '\r');
  };
  this.setZoneMute = function(id, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 1) { value = 1; }

    //Need to 0-pad number
    if ( value < 10 ) { value = "0" + value; };
    write('<' + id + 'MU' + value + '\r');

    this.getZoneMute(id);
  };

  //Keypad status is get-only
  function zone_keypad(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, keypad: data[2]});
  }
  this.getZoneKeypad = function(id) {
    write('?' + id + "LS" + '\r');
  };

  //PA status is get-only
  function zone_pa(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, pa: data[2]});
  }
  this.getZonePublicAddress = function(id) {
    write('?' + id + "PA" + '\r');
  };

  function zone_volume(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, volume: data[2]});
  }
  this.getZoneVolume = function(id) {
    write('?' + id + "VO" + '\r');
  };
  this.setZoneVolume = function(id, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 38) { value = 38; }

    //Need to 0-pad number
    if ( value < 10 ) { value = "0" + value; };
    write('<' + id + 'VO' + value + '\r');

    this.getZoneVolume(id);
  };

  function zone_bass(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, bass: data[2]});
  }
  this.getZoneBass = function(id) {
    write('?' + id + "BS" + '\r');
  };
  this.setZoneBass = function(id, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 14) { value = 14; }

    //Need to 0-pad number
    if ( value < 10 ) { value = "0" + value; };
    write('<' + id + 'BS' + value + '\r');

    this.getZoneBass(id);
  };

  function zone_treble(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, treble: data[2]});
  }
  this.getZoneTreble = function(id) {
    write('?' + id + "TR" + '\r');
  };
  this.setZoneTreble = function(id, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 14) { value = 14; }

    //Need to 0-pad number
    if ( value < 10 ) { value = "0" + value; };
    write('<' + id + 'TR' + value + '\r');

    this.getZoneTreble(id);
  };

  function zone_balance(data) {
    z = (data[0]*10) + data[1]
    notify_handler({type: 'zone', controller: data[0], zone: z, balance: data[2]});
  }
  this.getZoneBalance = function(id) {
    //get Zone balance should look like ?xxBL'CR' where xx is the zone number
    write('?' + id + "BL" + '\r');
  };
  this.setZoneBalance = function(id, balance) {
    //set Zone balance should look like <xxBLnn'CR' where xx is the zone number and nn is the value
    if ( balance < 0 ) { balance = 0; }
    if ( balance > 20) { balance = 20; }

    //Need to 0-pad number
    if ( balance < 10 ) { balance = "0" + balance; };
    write('<' + id + 'BL' + balance + '\r');

    //unit is supposed to respond with inquiry(2) response -- but it doesn't.
    this.getZoneBalance(id);
  };

  /**
   * Helper Functions
   */
  function notify_handler(data) {
    notify(JSON.stringify(data));
    //logger(JSON.stringify(data));
  }

  function getSerialPorts() {
    if (serialPorts.length > 0) { return; }
    serialport.list(function (err, ports) {
      ports.forEach(function(port) {
        serialPorts.push(port.comName);
      });
      logger('Detected serial ports: ' + JSON.stringify(serialPorts));
    });
  }

  function getCommandCode(str) {
  	response = getMatches(str,'^#>\\d{2}(.{2})\\d{2}$');
  	if (!response) { return null; }
  	return response[0];
  }

  function getMatches(arr, pattern) {
    if (!pattern) { return null; }

    var re = new RegExp(pattern);
    var tmp = re.exec(arr);

    if (!tmp) { return null; }

    var matches = [];
    for(var i=1; i<tmp.length; i++) {
      //logger(parseInt(tmp[i]));
      matches.push(tmp[i]);
    }
    //logger(matches);
    return matches;
  }

  function stringifyByteArray(arr) {
    str = '';
    for(var i=0; i<arr.length; i++) {
      str = str+' 0x'+("0" + arr[i].toString(16)).slice(-2);
    }
    return str;
  }

  function stringifyByteArrayNpad(arr) {
    str = '';
    for(var i=0; i<arr.length; i++) {
      str = str+("0" + arr[i].toString(16)).slice(-2);
    }
    return str;
  }

  /**
   * Constants
   */
  var RESPONSE_TYPES = {
  	'BL': {
  	  'name' : 'Zone Balance',
  	  'description' : 'Zone balance level (00 = more left .. 10 = center .. 20 = more right)',
  	  'pattern' : '^#>(\\d)(\\d)BL(\\d{2})$',
  	  'handler' : zone_balance },
  	'VO': {
  	  'name' : 'Zone Volume',
  	  'description' : 'Zone volume level (00 = more quiet .. 38 = more loud)',
  	  'pattern' : '^#>(\\d)(\\d)VO(\\d{2})$',
  	  'handler' : zone_volume },
  	'BS': {
  	  'name' : 'Zone Bass',
  	  'description' : 'Zone bass level (00 = less bass .. 7 = center .. 14 = most bass)',
  	  'pattern' : '^#>(\\d)(\\d)BS(\\d{2})$',
  	  'handler' : zone_bass },
  	'TR': {
  	  'name' : 'Zone Treble',
  	  'description' : 'Zone treble level (00 = less treble .. 7 = center .. 14 = most treble)',
  	  'pattern' : '^#>(\\d)(\\d)TR(\\d{2})$',
  	  'handler' : zone_treble },
  	'CH': {
  	  'name' : 'Zone Source',
  	  'description' : 'Zone source selected [01-06]',
  	  'pattern' : '^#>(\\d)(\\d)CH(\\d{2})$',
  	  'handler' : zone_source },
  	'MU': {
  	  'name' : 'Zone Mute',
  	  'description' : 'Zone mute status [00 = off, 01 = on]',
  	  'pattern' : '^#>(\\d)(\\d)MU(\\d{2})$',
  	  'handler' : zone_mute },
  	'DT': {
  	  'name' : 'Zone Mute',
  	  'description' : 'Zone Do Not Disturb status [00 = off, 01 = on]',
  	  'pattern' : '^#>(\\d)(\\d)DT(\\d{2})$',
  	  'handler' : zone_dnd },
  	'LS': {
  	  'name' : 'Zone Keypad Status',
  	  'description' : 'Zone keypad status [00 = not connected, 01 = connected]',
  	  'pattern' : '^#>(\\d)(\\d)LS(\\d{2})$',
  	  'handler' : zone_keypad },
  	'PA': {
  	  'name' : 'Zone PA Control Status',
  	  'description' : 'Zone PA Control status [00 = not controlled, 01 = controlled]',
  	  'pattern' : '^#>(\\d)(\\d)PA(\\d{2})$',
  	  'handler' : zone_pa },
  	'PR': {
  	  'name' : 'Zone Power Status',
  	  'description' : 'Zone power status [00 = off, 01 = on]',
  	  'pattern' : '^#>(\\d)(\\d)PR(\\d{2})$',
  	  'handler' : zone_state },
    'ALL': {
      'name' : 'Zone Info',
      'description' : 'All zone info',
      'pattern' : '^#>(\\d)(\\d)(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})$',
      'handler' : zone_info }
  };
}
