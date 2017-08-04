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
app.get('/controllers/:controller/zones/:zone/balance', function (req, res) {
  mpr6z.getZoneBalance(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/treble', function (req, res) {
  mpr6z.getZoneTreble(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/bass', function (req, res) {
  mpr6z.getZoneBass(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/volume', function (req, res) {
  mpr6z.getZoneVolume(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/mute', function (req, res) {
  mpr6z.getZoneMute(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/source', function (req, res) {
  mpr6z.getZoneSource(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/state', function (req, res) {
  mpr6z.getZoneState(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/dnd', function (req, res) {
  mpr6z.getZoneDoNotDisturb(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/keypad', function (req, res) {
  mpr6z.getZoneKeypad(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/pa', function (req, res) {
  mpr6z.getZonePublicAddress(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone', function (req, res) {
  mpr6z.getZone(Number(req.params.controller), Number(req.params.zone));
  res.end();
});

/**
 * Parameter Setters
*/
app.get('/controllers/:controller/zones/:zone/balance/:balance', function (req, res) {
  mpr6z.setZoneBalance(Number(req.params.controller), Number(req.params.zone), Number(req.params.balance));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/treble/:treble', function (req, res) {
  mpr6z.setZoneTreble(Number(req.params.controller), Number(req.params.zone), Number(req.params.treble));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/bass/:bass', function (req, res) {
  mpr6z.setZoneBass(Number(req.params.controller), Number(req.params.zone), Number(req.params.bass));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/volume/:volume', function (req, res) {
  mpr6z.setZoneVolume(Number(req.params.controller), Number(req.params.zone), Number(req.params.volume));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/mute/:mute', function (req, res) {
  mpr6z.setZoneMute(Number(req.params.controller), Number(req.params.zone), Number(req.params.mute));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/source/:source', function (req, res) {
  mpr6z.setZoneSource(Number(req.params.controller), Number(req.params.zone), Number(req.params.source));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/state/:state', function (req, res) {
  mpr6z.setZoneState(Number(req.params.controller), Number(req.params.zone), Number(req.params.state));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/dnd/:state', function (req, res) {
  mpr6z.setZoneDoNotDisturb(Number(req.params.controller), Number(req.params.zone), Number(req.params.state));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/all/:state', function (req, res) {
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
  var parser = null;
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

    if (device && device.isOpen) { return };

    device = new serialport(nconf.get('mpr6z:serialPort'),
      { baudRate: nconf.get('mpr6z:baudRate'),
        autoOpen: false
      });

    parser = device.pipe(new serialport.parsers.Readline());
    parser.on('data', function(data) {
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
    if (!device || !device.isOpen) {
      logger('MPR6Z not connected.');
      return;
    }

    if (!cmd || cmd.length == 0) { return; }
    logger('TX > '+cmd);
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
    logger('RX < '+data);

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
    notify_handler({
      type: 'zone',
      controller: data[0],
      zone: data[1],
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

  this.getZone = function(controller, zone) {
    //this one wants to get all the things for a zone
    // inquiry '?xx\r' where xx is the zone #
    write('?' + controller + zone + '\r');
  };

  this.setAllZones = function(state) {
    //MPR-6Z doesn't have an "all-off" or "all-on" function, but we can build one.
    var controllers = nconf.get('mpr6z:controllerConfig')['controllers'];
    for (var i = 0; i < controllers.length; i++)
    {
      var zones = controllers[i]['zones'];
      for (var j = 0; j < zones.length; j++)
      {
        this.setZoneState(controllers[i]['controller'], zones[j]['zone'], state);
      }
    }
    //I don't think I need this since each setZoneState sends its own notification
    //notify_handler({type: 'zone', controller: 1, zone: -1, state: state});
  };

  function zone_state(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], state: data[2]});
  }
  this.getZoneState = function(controller, zone) {
    write('?' + controller + zone + 'PR' + '\r');
  };
  this.setZoneState = function(controller, zone, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 1) { value = 1; }

    //Need to 0-pad number
    value = ("0"+value).slice(-2);
    write('<' + controller + zone + 'PR' + value + '\r');

    this.getZoneState(controller, zone);
  };

  function zone_dnd(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], state: data[2]});
  }
  this.getZoneDoNotDisturb = function(controller, zone) {
    write('?' + controller + zone + 'DT' + '\r');
  };
  this.setZoneDoNotDisturb = function(controller, zone, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 1) { value = 1; }

    //Need to 0-pad number
    value = ("0"+value).slice(-2);
    write('<' + controller + zone + 'DT' + value + '\r');

    this.getZoneDoNotDisturb(controller, zone);
  };

  function zone_source(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], source: data[2], sourceName: nconf.get('mpr6z:sources')[data[2]-1]});
  }
  this.getZoneSource = function(controller, zone) {
    write('?' + controller + zone + 'CH' + '\r');
  };
  this.setZoneSource = function(controller, zone, value) {
    if ( value < 1 ) { value = 1; }
    if ( value > 6) { value = 6; }

    //Need to 0-pad number
    value = ("0"+value).slice(-2);
    write('<' + controller + zone + 'CH' + value + '\r');

    this.getZoneSource(controller, zone);
  };

  function zone_mute(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], mute: data[2]});
  }
  this.getZoneMute = function(controller, zone) {
    write('?' + controller + zone + 'MU' + '\r');
  };
  this.setZoneMute = function(controller, zone, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 1) { value = 1; }

    //Need to 0-pad number
    value = ("0"+value).slice(-2);
    write('<' + controller + zone + 'MU' + value + '\r');

    this.getZoneMute(controller, zone);
  };

  //Keypad status is get-only
  function zone_keypad(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], keypad: data[2]});
  }
  this.getZoneKeypad = function(controller, zone) {
    write('?' + controller + zone + 'LS' + '\r');
  };

  //PA status is get-only
  function zone_pa(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], pa: data[2]});
  }
  this.getZonePublicAddress = function(controller, zone) {
    write('?' + controller + zone + 'PA' + '\r');
  };

  function zone_volume(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], volume: data[2]});
  }
  this.getZoneVolume = function(controller, zone) {
    write('?' + controller + zone + 'VO' + '\r');
  };
  this.setZoneVolume = function(controller, zone, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 38) { value = 38; }

    //Need to 0-pad number
    value = ("0"+value).slice(-2);
    write('<' + controller + zone + 'VO' + value + '\r');

    this.getZoneVolume(controller, zone);
  };

  function zone_bass(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], bass: data[2]});
  }
  this.getZoneBass = function(controller, zone) {
    write('?' + controller + zone + 'BS' + '\r');
  };
  this.setZoneBass = function(controller, zone, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 14) { value = 14; }

    //Need to 0-pad number
    value = ("0"+value).slice(-2);
    write('<' + controller + zone + 'BS' + value + '\r');

    this.getZoneBass(controller, zone);
  };

  function zone_treble(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], treble: data[2]});
  }
  this.getZoneTreble = function(controller, zone) {
    write('?' + controller + zone + 'TR' + '\r');
  };
  this.setZoneTreble = function(controller, zone, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 14) { value = 14; }

    //Need to 0-pad number
    value = ("0"+value).slice(-2);
    write('<' + controller + zone + 'TR' + value + '\r');

    this.getZoneTreble(controller, zone);
  };

  function zone_balance(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], balance: data[2]});
  }
  this.getZoneBalance = function(controller, zone) {
    //get Zone balance should look like ?xxBL'CR' where xx is the zone number
    write('?' + controller + zone + 'BL' + '\r');
  };
  this.setZoneBalance = function(controller, zone, value) {
    if ( value < 0 ) { value = 0; }
    if ( value > 20) { value = 20; }

    //set Zone balance should look like <xxBLnn'CR' where xx is the zone number and nn is the value
    value = ("0"+value).slice(-2);
    write('<' + controller + zone + 'BL' + value + '\r');

    //unit is supposed to respond with inquiry(2) response -- but it doesn't.
    this.getZoneBalance(controller, zone);
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
