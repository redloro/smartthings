/**
 *  Russound RNET Plugin
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
 *
 *  Supported Commands:
 *   Zone On/Off state (0x00 = OFF or 0x01 = ON)
 *   Source selected -1
 *   Volume level (0x00 - 0x32, 0x00 = 0 Displayed ... 0x32 = 100 Displayed)
 *   Bass level (0x00 = -10 ... 0x0A = Flat ... 0x14 = +10)
 *   Treble level (0x00 = -10 ... 0x0A = Flat ... 0x14 = +10)
 *   Loudness (0x00 = OFF, 0x01 = ON )
 *   Balance level (0x00 = More Left ... 0x0A = Center ... 0x14 = More Right)
 *   System On state (0x00 = All Zones Off, 0x01 = Any Zone is On)
 *   Shared Source (0x00 = Not Shared 0x01 = Shared with another Zone)
 *   Party Mode state (0x00 = OFF, 0x01 = ON, 0x02 = Master)*
 *   Do Not Disturb state (0x00 = OFF, 0x01 = ON )*
*/
var express = require('express');
var serialport = require("serialport");
var app = express();
var nconf = require('nconf');
nconf.file({ file: './config.json' });
var notify;
var logger = function(str) {
  mod = 'rnet';
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json(rnet.check());
});
app.get('/discover', function (req, res) {
  rnet.discover();
  res.end();
});
app.get('/controllers/:controller/zones/:zone/partyMode/:partyMode', function (req, res) {
  rnet.setZonePartyMode(Number(req.params.controller), Number(req.params.zone), Number(req.params.partyMode));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/partyMode', function (req, res) {
  rnet.getZonePartyMode(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/balance/:balance', function (req, res) {
  rnet.setZoneBalance(Number(req.params.controller), Number(req.params.zone), Number(req.params.balance));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/balance', function (req, res) {
  rnet.getZoneBalance(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/treble/:treble', function (req, res) {
  rnet.setZoneTreble(Number(req.params.controller), Number(req.params.zone), Number(req.params.treble));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/treble', function (req, res) {
  rnet.getZoneTreble(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/bass/:bass', function (req, res) {
  rnet.setZoneBass(Number(req.params.controller), Number(req.params.zone), Number(req.params.bass));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/bass', function (req, res) {
  rnet.getZoneBass(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/loudness/:loudness', function (req, res) {
  rnet.setZoneLoudness(Number(req.params.controller), Number(req.params.zone), Number(req.params.loudness));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/loudness', function (req, res) {
  rnet.getZoneLoudness(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/volume/:volume', function (req, res) {
  rnet.setZoneVolume(Number(req.params.controller), Number(req.params.zone), Number(req.params.volume));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/volume', function (req, res) {
  rnet.getZoneVolume(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/source/:source', function (req, res) {
  rnet.setZoneSource(Number(req.params.controller), Number(req.params.zone), Number(req.params.source));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/source', function (req, res) {
  rnet.getZoneSource(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/state/:state', function (req, res) {
  rnet.setZoneState(Number(req.params.controller), Number(req.params.zone), Number(req.params.state));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/state', function (req, res) {
  rnet.getZoneState(Number(req.params.controller), Number(req.params.zone));
  res.end();
});
app.get('/controllers/:controller/zones/:zone/all/:state', function (req, res) {
  rnet.setAllZones(Number(req.params.state));
  res.end();
});
app.get('/controllers/:controller/zones/:zone', function (req, res) {
  rnet.getZone(Number(req.params.controller), Number(req.params.zone));
  res.end();
});

module.exports = function(f) {
  notify = f;
  return app;
};

/**
 * RNET
 */
var rnet = new Rnet();
rnet.init();

function Rnet() {
  var self = this;
  var device = null;
  var buffer = new Array();
  var serialPorts = new Array();

  // fix for RNET protocol change for C-Series devices
  var cseries = (nconf.get('rnet:c-series')) ? true : false;
  var byteFlag = (cseries) ? 0x71 : 0x70;

  /**
   * init
   */
  this.init = function() {
    getSerialPorts();

    if (!nconf.get('rnet:serialPort')) {
        logger('** NOTICE ** RNET serial port not set in config file!');
        return;
    }

    if (device && device.isOpen) { return };

    device = new serialport(nconf.get('rnet:serialPort'), { baudRate: 19200, autoOpen: false });

    device.on('data', function(data) {
      for(var i=0; i<data.length; i++) {
        buffer.push(data[i]);
        if (data[i] == 0xf7) {
          //logger('data: ' + stringifyByteArray(data));
          read(buffer);
          buffer = new Array();
        }
      }
    });

    device.open(function (error) {
      if (error) {
        logger('RNET connection error: '+error);
        device = null;
        return;
      } else {
        logger('Connected to RNET: '+nconf.get('rnet:serialPort'));
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
      return { status: 'Russound RNET plugin offline', "serialPorts": serialPorts };
    }
    return { status: 'Russound RNET plugin running' };
  };

  /**
   * write
   */
  function write(cmd) {
    if (!device || !device.isOpen) {
      logger('RNET not connected.');
      return;
    }

    if (!cmd || cmd.length == 0) { return; }
    //logger('TX > '+cmd);
    device.write(buildCommand(cmd), function(err, results) {
      if (err) logger('RNET write error: '+err);
    });
  }

  this.command = function(cmd) {
    write(cmd);
  };

  /**
   * read
   */
  function read(data) {
    if (data.length == 0) { return; }
    data.splice(-2);
    //logger('RX < '+stringifyByteArray(data));

    var code = getSignificantBytes(data);
    if (!code) {
      //logger('** no significant bytes found');
      unhandledMessage(data);
      return;
    }

    // generic handler
    //logger('Handler: '+JSON.stringify(RESPONSE_TYPES[code]));
    var response = RESPONSE_TYPES[code];
    if (!response) {
      //logger('** no response handler found: ' + code);
      unhandledMessage(data);
      return;
    }

    var matches = getMatches(data, response['pattern']);
    if (!matches) {
      //logger('** no matches found for code: ' + code);
      unhandledMessage(data);
      return;
    }

    //logger('** OK matches: ' + matches);
    responseHandler = response['handler'];
    responseHandler(matches);
  }

  /**
   * Discovery Handlers
   */
  this.discover = function() {
    if (nconf.get('rnet:controllerConfig')) {
      notify_handler(nconf.get('rnet:controllerConfig'));
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
      state: data[2],
      source: data[3],
      sourceName: nconf.get('rnet:sources')[data[3]],
      volume: data[4],
      bass: data[5],
      treble: data[6],
      loudness: data[7],
      balance: data[8],
      system: data[9],
      sharedSource: data[10],
      partyMode: data[11],
      doNotDisturb: data[12] });
  }
  this.getZone = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x04, 0x02, 0x00, zone, 0x07, 0x00, 0x00]);
  };
  this.setAllZones = function(state) {
    write([0xF0, 0x7E, 0x00, 0x7F, 0x00, 0x00, byteFlag, 0x05, 0x02, 0x02, 0x00, 0x00, 0xF1, 0x22, 0x00, (cseries) ? state : 0x00, (cseries) ? 0x00 : state, 0x00, 0x00, 0x01]);
    notify_handler({type: 'zone', controller: -1, zone: -1, state: state});
  };

  function zone_state(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], state: data[2]});
  }
  this.getZoneState = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x04, 0x02, 0x00, zone, 0x06, 0x00, 0x00]);
  };
  this.setZoneState = function(controller, zone, state) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x05, 0x02, 0x02, 0x00, 0x00, 0xF1, 0x23, 0x00, state, 0x00, zone, 0x00, 0x01]);
    zone_state([controller, zone, state]);
  };

  function zone_source(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], source: data[2], sourceName: nconf.get('rnet:sources')[data[2]]});
  }
  this.getZoneSource = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x04, 0x02, 0x00, zone, 0x02, 0x00, 0x00]);
  };
  this.setZoneSource = function(controller, zone, source) {
    write([0xF0, controller, 0x00, 0x7F, controller, zone, byteFlag, 0x05, 0x02, 0x00, 0x00, 0x00, 0xF1, 0x3E, 0x00, 0x00, 0x00, source, 0x00, 0x01]);
    // TODO: NEED TO CHECK AND SEE IF SOURCES ARE TIED TO CONTROLLER
    zone_source([controller, zone, source, nconf.get('rnet:sources')[source]]);
  };

  function zone_volume(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], volume: data[2]});
  }
  this.getZoneVolume = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x04, 0x02, 0x00, zone, 0x01, 0x00, 0x00]);
  };
  this.setZoneVolume = function(controller, zone, volume) {
    write([0xF0, controller, (cseries) ? zone : 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x05, 0x02, 0x02, 0x00, 0x00, 0xF1, 0x21, 0x00, volume, 0x00, zone, 0x00, 0x01]);
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x00, 0x05, 0x02, 0x00, zone, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, volume]);
    zone_volume([controller, zone, volume]);
  };

  function zone_bass(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], bass: data[2]});
  }
  this.getZoneBass = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x05, 0x02, 0x00, zone, 0x00, 0x00, 0x00, 0x00]);
  };
  this.setZoneBass = function(controller, zone, bass) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x00, 0x05, 0x02, 0x00, zone, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, bass]);
    zone_bass([controller, zone, bass]);
  };

  function zone_treble(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], treble: data[2]});
  }
  this.getZoneTreble = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x05, 0x02, 0x00, zone, 0x00, 0x01, 0x00, 0x00]);
  };
  this.setZoneTreble = function(controller, zone, treble) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x00, 0x05, 0x02, 0x00, zone, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, treble]);
    zone_treble([controller, zone, treble]);
  };

  function zone_loudness(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], loudness: data[2]});
  }
  this.getZoneLoudness = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x05, 0x02, 0x00, zone, 0x00, 0x02, 0x00, 0x00]);
  };
  this.setZoneLoudness = function(controller, zone, loudness) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x00, 0x05, 0x02, 0x00, zone, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, loudness]);
    zone_loudness([controller, zone, loudness]);
  };

  function zone_balance(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], balance: data[2]});
  }
  this.getZoneBalance = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x05, 0x02, 0x00, zone, 0x00, 0x03, 0x00, 0x00]);
  };
  this.setZoneBalance = function(controller, zone, balance) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x00, 0x05, 0x02, 0x00, zone, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, balance]);
    zone_balance([controller, zone, balance]);
  };

  function zone_party_mode(data) {
    notify_handler({type: 'zone', controller: data[0], zone: data[1], partyMode: data[2]});
  }
  this.getZonePartyMode = function(controller, zone) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x01, 0x05, 0x02, 0x00, zone, 0x00, 0x07, 0x00, 0x00]);
  };
  this.setZonePartyMode = function(controller, zone, partyMode) {
    write([0xF0, controller, 0x00, 0x7F, controller, (cseries) ? zone : 0x00, byteFlag, 0x00, 0x05, 0x02, 0x00, zone, 0x00, 0x07, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, partyMode]);
    zone_party_mode([controller, zone, partyMode]);
  };

  function display_feedback(data) {
    var buffer = byteArrayFromString(data[1].substr(0,data[0]*2)).slice(1);
    var msgTypeSource = buffer.shift();
    var flashTimeLow = buffer.shift();
    var flashTimeHigh = buffer.shift();
    var msgText = byteArrayToString(buffer);
    //notify_handler({type: 'broadcast', controller: data[0], type: (msgTypeSource & 0x10) ? 'single' : 'multi', source: msgTypeSource & 0x0F, text: msgText});
    logger({type: 'broadcast', controller: data[0], type: (msgTypeSource & 0x10) ? 'single' : 'multi', source: msgTypeSource & 0x0F, text: msgText});
  }

  /**
   * Helper Functions
   */
  function notify_handler(data) {
    notify(JSON.stringify(data));
    logger(JSON.stringify(data));
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

  function getSignificantBytes(arr) {
    //ignore arr[7] = 0x02 (handshake message)
    //ignore arr[7] = 0x06 (unknown message type)
    if (arr.length < 15) { return null; };

    // if arr[3] === 70 message is for CAV, CAM, CAA
    // if arr[3] === 71 message is for C-Series MCA-3, MCA-5
    var id = ("0" + arr[3].toString(16)).slice(-2);
    id = (id === '70' || id === '71') ? 'XX' : id;
    return id +
           ("0" + arr[9].toString(16)).slice(-2)+
           ("0" + arr[13].toString(16)).slice(-2)+
           ("0" + arr[14].toString(16)).slice(-2);
  }

  function getMatches(arr, pattern) {
    if (!pattern) { return null; }
    var re = new RegExp(pattern);
    var tmp = re.exec(stringifyByteArrayNpad(arr));

    if (!tmp) { return null; }
    var matches = [];
    for(var i=1; i<tmp.length; i++) {
      if (tmp[i].length == 2) { matches.push(parseInt(tmp[i],16)); }
      else { matches.push(tmp[i]); }
    }
    return matches;
  }

  function stringifyByte(byte) {
    return '0x'+("0" + byte.toString(16)).slice(-2);
  }

  function stringifyByteArray(arr) {
    str = '';
    for(var i=0; i<arr.length; i++) {
      str = str+' 0x'+("0" + arr[i].toString(16)).slice(-2);
    }
    str = str.trim();
    return str;
  }

  function stringifyByteArrayNpad(arr) {
    str = '';
    for(var i=0; i<arr.length; i++) {
      str = str+("0" + arr[i].toString(16)).slice(-2);
    }
    return str;
  }

  function byteArrayFromString(str) {
    var arr = [];
    while(str.length) {
      arr.push(parseInt(str.substring(0,2),16));
      str = str.substring(2);
    }
    return arr;
  }

  function byteArrayToString(arr) {
    var string = '';
    while(char = arr.shift()) {
      string += String.fromCharCode(char);
    }
    return string.trim();
  }

  function buildCommand(cmd) {
      var chksum=0;
      var i=cmd.length;
      while(i--) chksum += cmd[i];
      chksum += cmd.length;
      chksum = chksum & 0x007F;
      cmd.push(chksum, 0xF7);
      //logger('command: ' + stringifyByteArray(cmd));
      return cmd;
  }

  function unhandledMessage(data) {
    if (data[0] != 0xF0) {
      logger('** invalid message: ' + stringifyByteArray(data));
      return;
    }

    // remove start of message byte 0xF0
    data.shift();
    var msg = { "Target Device" : {
                  "Controller": stringifyByte(data.shift()),
                  "Zone": stringifyByte(data.shift()),
                  "Keypad": stringifyByte(data.shift())
                },
                "Source Device" : {
                  "Controller": stringifyByte(data.shift()),
                  "Zone": stringifyByte(data.shift()),
                  "Keypad": stringifyByte(data.shift())
                },
                "Message Type" : stringifyByte(data.shift()),
                "Message Body" : stringifyByteArray(data)
              };
    //logger('** unknown message: ' + JSON.stringify(msg));
  }

  /**
   * Constants
   */
  // match bytes [9][13][14]
  var RESPONSE_TYPES = {
    'XX040700': {
      'name' : 'Zone Info',
      'description' : 'All zone info',
      'pattern' : '^f000.{2}7[01](.{2})007f0000040200(.{2})07000001000c00(.{2})(.{2})(.{2})(.{2})(.{2})(.{2})(.{2})(.{2})(.{2})(.{2})(.{2})00$',
      'handler' : zone_info },
    'XX040600': {
      'name' : 'Zone State',
      'description' : 'Zone state change (on/off)',
      'pattern' : '^f000.{2}7[01](.{2})007f0000040200(.{2})06000001000100(.{2})$',
      'handler' : zone_state },
    'XX040200' : {
      'name' : 'Zone Source',
      'description' : 'Zone source selected (0-5)',
      'pattern' : '^f000.{2}7[01](.{2})007f0000040200(.{2})02000001000100(.{2})$',
      'handler' : zone_source },
    'XX040100' : {
      'name' : 'Zone Volume',
      'description' : 'Zone volume level (0x00 - 0x32, 0x00 = 0 ... 0x32 = 100 displayed)',
      'pattern' : '^f000.{2}7[01](.{2})007f0000040200(.{2})01000001000100(.{2})$',
      'handler' : zone_volume },
    'XX050000' : {
      'name' : 'Zone Bass',
      'description' : 'Zone bass level (0x00 = -10 ... 0x0A = Flat ... 0x14 = +10)',
      'pattern' : '^f000.{2}7[01](.{2})007f0000050200(.{2})0000000001000100(.{2})$',
      'handler' : zone_bass },
    'XX050001' : {
      'name' : 'Zone Treble',
      'description' : 'Zone treble level (0x00 = -10 ... 0x0A = Flat ... 0x14 = +10)',
      'pattern' : '^f000.{2}7[01](.{2})007f0000050200(.{2})0001000001000100(.{2})$',
      'handler' : zone_treble },
    'XX050002' : {
      'name' : 'Zone Loudness',
      'description' : 'Zone loudness (0x00 = off, 0x01 = on )',
      'pattern' : '^f000.{2}7[01](.{2})007f0000050200(.{2})0002000001000100(.{2})$',
      'handler' : zone_loudness },
    'XX050003' : {
      'name' : 'Zone Balance',
      'description' : 'Zone balance level (0x00 = more left ... 0x0A = center ... 0x14 = more right)',
      'pattern' : '^f000.{2}7[01](.{2})007f0000050200(.{2})0003000001000100(.{2})$',
      'handler' : zone_balance },
    'XX050007' : {
      'name' : 'Zone Party Mode',
      'description' : 'Zone party mode state (0x00 = off, 0x01 = on, 0x02 = master)',
      'pattern' : '^f000.{2}7[01](.{2})007f0000050200(.{2})0007000001000100(.{2})$',
      'handler' : zone_party_mode },
    '79010100' : {
        'name' : 'Display Feedback',
        'description' : 'Show display feedback for given zone',
        'pattern' : '^f0000079007d000002010102010100000100(.{2})(.*)$',
        'handler' : display_feedback }
  };
}
