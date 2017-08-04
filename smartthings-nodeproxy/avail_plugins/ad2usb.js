/**
 *  AlarmDecoder AD2USB Plugin
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
 *  References and credit:
 *   http://www.alarmdecoder.com/catalog/product_info.php/products_id/29
 *   https://github.com/nutechsoftware/alarmdecoder
 */
var express = require('express');
var net = require('net');
var serialport = require("serialport");
var app = express();
var split = require('split');
var nconf = require('nconf');
nconf.file({ file: './config.json' });
var notify;
var logger = function(str) {
  mod = 'ad2';
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: 'AlarmDecoder AD2USB plugin running' });
});

app.get('/disarm', function (req, res) {
  if (nconf.get('ad2usb:securityCode')) {
    ad2.command(nconf.get('ad2usb:securityCode')+'1');
  }
  res.end();
});

app.get('/armAway', function (req, res) {
  if (nconf.get('ad2usb:securityCode')) {
    ad2.command(nconf.get('ad2usb:securityCode')+'2');
  }
  res.end();
});

app.get('/armStay', function (req, res) {
  if (nconf.get('ad2usb:securityCode')) {
    ad2.command(nconf.get('ad2usb:securityCode')+'3');
  }
  res.end();
});

app.get('/armInstant', function (req, res) {
  if (nconf.get('ad2usb:securityCode')) {
    ad2.command(nconf.get('ad2usb:securityCode')+'7');
  }
  res.end();
});

app.get('/chime', function (req, res) {
  if (nconf.get('ad2usb:securityCode')) {
    ad2.command(nconf.get('ad2usb:securityCode')+'9');
  }
  res.end();
});

app.get('/trigger/:output', function (req, res) {
  if (nconf.get('ad2usb:securityCode')) {
    if (req.params.output === '17' || req.params.output === '18') {
      ad2.command(nconf.get('ad2usb:securityCode')+'#7'+req.params.output);
      setTimeout(function() {
        ad2.command(nconf.get('ad2usb:securityCode')+'#8'+req.params.output);
      }, 2000);
    }
  }
  res.end();
});

app.get('/bypass/:zones', function (req, res) {
  if (nconf.get('ad2usb:securityCode')) {
    var zones = req.params.zones.split(',').map(function(x) {
      x = ('00'+x.trim()).slice(-2);
      return (x === '00') ? '' : x;
    }).join('');

    if (zones) {
      ad2.command(nconf.get('ad2usb:securityCode')+'6'+zones);
    }
  }
  res.end();
});

app.get('/config/:host', function (req, res) {
  nconf.set('ad2usb:securityCode', req.params.host);
  nconf.save(function (err) {
    if (err) {
      logger('Configuration error: '+err.message);
      res.status(500).json({ error: 'Configuration error: '+err.message });
      return;
    }
  });
  res.end();
});

app.get('/discover', function (req, res) {
  ad2.discover();
  res.end();
});

app.get('/command/:cmd', function (req, res) {
  //BE CAREFUL
  //ad2.command(req.params.cmd);
  res.end();
});

module.exports = function(f) {
  notify = f;
  return app;
};

/**
 * AD2USB
 */
var ad2 = new AD2USB();
ad2.init();

function AD2USB () {
  var self = this;
  var device = null;
  var parser = null;
  var mode = nconf.get('ad2usb:mode') || 'serial';
  var serialPorts = new Array();
  var panel = {alpha: '', timer: [], partition: 1, zones: []};

  /**
   * init
   */
  this.init = function() {
    logger('AD2USB connect mode set to: '+mode);

    if (mode === 'serial') {
      getSerialPorts();

      if (!nconf.get('ad2usb:serialPort')) {
          logger('** NOTICE ** AD2USB serial port not set in config file!');
          return;
      }

      if (device && device.isOpen) { return };

      device = new serialport(nconf.get('ad2usb:serialPort'), {
          baudRate: 115200,
          autoOpen: false
        });

      parser = device.pipe(new serialport.parsers.Readline());
      parser.on('data', function(data) {
        read(data);
      });

      device.open(function(error) {
        if (error) {
          logger('AD2USB connection error: '+error);
          device = null;
          return;
        } else {
          logger('Connected to AD2USB: '+nconf.get('ad2usb:serialPort'));
        }
      });
    } else {
      if (!nconf.get('ad2usb:address') || !nconf.get('ad2usb:port')) {
          logger('** NOTICE ** AD2USB IP settings not set in config file!');
          return;
      }


      if (device && device.writable) { return; }
      if (device) { device.destroy(); }

      device = new net.Socket();
      device.on('error', function(err) {
        logger("AD2USB connection error: "+err.description);
        device.destroy();
        setTimeout(function() { self.init() }, 4000);
      });

      device.on('close', function() {
        logger('AD2USB connection closed.');
        device.destroy();
        setTimeout(function() { self.init() }, 4000);
      });

      device.pipe(split()).on('data', function (data) {
        read(data.toString('ascii'));
      });

      device.connect(nconf.get('ad2usb:port'), nconf.get('ad2usb:address'), function() {
        logger('Connected to AD2USB at '+nconf.get('ad2usb:address')+':'+nconf.get('ad2usb:port'));
      });
    }
  };

  // check connection every 60 secs
  setInterval(function() { self.init(); }, 60*1000);

  /**
   * write
   */
  function write(cmd) {
    if (!device || !checkDevice()) {
      logger('AD2USB not connected.');
      return;
    }

    if (!cmd || cmd.length == 0) { return; }
    logger('TX > '+cmd);
    device.write(cmd, function(err, results) {
      if (err) logger('AD2USB write error: '+err);
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
    logger('RX < '+data);

    try {
      if (data.match(/^\[/)) {
        keypad_update(data);
      } else if (data.match(/^!RFX/)) {
        rfx_update(data);
      }
    } catch (err) {
      logger('Error: '+err);
    }
  }

  /**
   * checkDevice
   */

  function checkDevice() {
    if (mode === 'serial') { return device.isOpen; }
    if (mode === 'ip') { return device.writable; }
    return false;
  }

  /**
   * getSerialPorts
   */
  function getSerialPorts() {
    if (serialPorts.length > 0) { return; }
    serialport.list(function (err, ports) {
      ports.forEach(function(port) {
        serialPorts.push(port.comName);
      });
      logger('Detected serial ports: ' + JSON.stringify(serialPorts));
    });
  }

  /**
   * discover
   */
  this.discover = function() {
    if (nconf.get('ad2usb:panelConfig')) {
      notify(JSON.stringify(nconf.get('ad2usb:panelConfig')));
      logger('Completed panel discovery');
    } else {
      logger('** NOTICE ** Panel configuration not set in config file!');
    }
  };

  /**
   * Generic Handlers
   */
  function rfx_update(data) {
    var map = data.split(/[:,]+/);
    if (map.length !== 3) {
      logger('Ignoring invalid data: '+data);
      return;
    }

    var msg = {};
    msg.partitionNumber = 1;

    // Section 1: 0222002
    msg.serial = map[1];
    msg.zone = getZoneBySerial(msg.serial);
    if (!msg.zone) {
      logger('Ignoring data for unknown zone: '+data);
      return;
    }
    msg.userOrZone = msg.zone.zone;

    // Section 2: 80
    msg.flags = parseInt(map[2], 16);

    if (msg.flags & RFX_FLAG.LOOP1) {
      // reset timer when new zone added
      panel.timer[msg.userOrZone] = 0;
      for (var n in panel.timer) {
        panel.timer[n] = 0;
      }

      // notify
      updateZone(msg.partitionNumber, msg.userOrZone, 'open');
      updatePartition(msg.partitionNumber, 'notready', 'FAULT '+msg.serial+' '+msg.zone.name.toUpperCase());
    } else if (!msg.flags) {
      // delete timer
      delete panel.timer[msg.userOrZone];

      // notify
      updateZone(msg.partitionNumber, msg.userOrZone, 'closed');
    }
  }

  function keypad_update(data) {
    //logger('Execute keypad_update: '+data);
    var map = data.split(',');
    if (map.length < 4) {
      logger('Ignoring invalid data: '+data);
      return;
    }

    var msg = {};
    msg.partitionNumber = 1;

    // Section 1:  [1000000100000000----]
    msg.flags = getLedFlag(map[0]);

    // Section 2: 008
    msg.userOrZone = parseInt(map[1]);

    // What should be done with this?
    // Section 3: [f702000b1008001c08020000000000]
    //console.log(map[2].replace(/[\[\]]/g, ''));

    // Section 4: "****DISARMED****  Ready to Arm  "
    msg.alpha = map[3].replace(/"/g, '').replace(/[ ]+/g, ' ').trim();
    msg.dscCode = getDscCode(msg.flags);
    console.log(msg);

    //////////
    // PARTITION UPDATE
    //////////
    if (panel.alpha != msg.alpha) {
      //notify
      updatePartition(msg.partitionNumber, getPartitionState(msg.flags, msg.alpha), msg.alpha);
    }

    // exception conditition - work around for hit * for faults
    if (msg.alpha.toLowerCase().indexOf('hit * for faults') !== -1 && nconf.get('ad2usb:clearFaults') === true) {
      logger('Exception condition - experimental workaround will automatically clear fault');
      write('*');
      return;
    }

    // exception conditition - should never be DISARMED and not READY
    if (msg.alpha.startsWith('DISARMED') && msg.dscCode !== 'READY') {
      logger('Exception condition - panel is DISARMED but not READY: '+JSON.stringify(msg));
      return;
    }

    //////////
    // ZONE UPDATE
    //////////

    // all zones are closed
    if (msg.dscCode == 'READY') {
      panel.timer = [];
      for (var n in panel.zones){
        if (panel.zones[n] != 'closed') {
          // notify
          updateZone(msg.partitionNumber, n, 'closed');
        }
      }
    }

    // one or more zones are open
    if (msg.dscCode == '') {
      if (panel.zones[msg.userOrZone] != 'open') {
        // reset timer when new zone added
        panel.timer[msg.userOrZone] = 0;
        for (var n in panel.timer) {
          panel.timer[n] = 0;
        }

        // notify
        updateZone(msg.partitionNumber, msg.userOrZone, 'open');
      } else {
        panel.timer[msg.userOrZone]++;

        // experimental: close all zones that have not updated after three ticks
        if (panel.timer[msg.userOrZone] == 2) {
          for (var n in panel.timer) {
            if (panel.timer[n] == 0) {
              // close orphaned zone
              delete panel.timer[n];

              // notify
              updateZone(msg.partitionNumber, n, 'closed');
            } else {
              // reset timer
              panel.timer[n] = 0;
            }
          }
        }
      }
    }

    // zone in alarm
    if (msg.dscCode == 'IN_ALARM') {
      if (panel.zones[msg.userOrZone] != 'alarm') {
        // notify
        updateZone(msg.partitionNumber, msg.userOrZone, 'alarm');
      }
    }
  }

  /**
   * Helper Functions
   */
  function updateZone(partitionNumber, zoneNumber, state) {
    panel.zones[zoneNumber] = state;

    var msg = JSON.stringify({type: 'zone', partition: partitionNumber, zone: zoneNumber, state: state});
    logger(msg);
    notify(msg);
  }

  function updatePartition(partitionNumber, state, alpha) {
    panel.alpha = alpha;

    var msg = JSON.stringify({type: 'partition', partition: partitionNumber, state: state, alpha: alpha});
    logger(msg);
    notify(msg);
  }

  function getLedFlag(part) {
    part = part.replace(/[\[\]]/g, '').split('');

    var flags = {};
    flags.disarmed = part.shift() === '1';
    flags.armed_away = part.shift() === '1';
    flags.armed_stay = part.shift() === '1';
    flags.backlight = part.shift() === '1';
    flags.programming = part.shift() === '1';
    flags.beep = VIRTUAL_KEYPAD_BEEP[part.shift()];
    flags.bypass = part.shift() === '1';
    flags.power = part.shift() === '1';
    flags.chime = part.shift() === '1';
    flags.alarm_in_memory = part.shift() === '1';
    flags.alarm = part.shift() === '1';
    flags.low_battery = part.shift() === '1';
    flags.armed_zero_entry_delay = part.shift() === '1';
    flags.fire = part.shift() === '1';
    flags.check_zone = part.shift() === '1';
    flags.perimeter_only = part.shift() === '1';
    return flags;
  }

  function getDscCode(flags) {
    var dscCode = '';
    if (flags.alarm || flags.fire) { dscCode = 'IN_ALARM'; }
    else if (flags.check_zone) { dscCode = 'NOT_READY'; }
    else if (flags.disarmed) { dscCode = 'READY'; }
    else if (flags.bypass) { dscCode = 'READY_BYPASS'; }
    else if (flags.armed_stay) { dscCode = 'ARMED_STAY'; }
    else if (flags.armed_away) { dscCode = 'ARMED_AWAY'; }
    else if (flags.armed_zero_entry_delay) { dscCode = 'ARMED_MAX'; }
    return dscCode;
  }

  function getPartitionState(flags, alpha) {
    if (flags.alarm || flags.fire) { return 'alarm'; }
    else if (flags.alarm_in_memory) { return 'alarmcleared'; }
    else if (alpha.indexOf('You may exit now') > 0) { return 'arming'; }
    else if (flags.armed_stay && flags.armed_zero_entry_delay) { return 'armedinstant'; }
    else if (flags.armed_away && flags.armed_zero_entry_delay) { return 'armedmax'; }
    else if (flags.armed_stay) { return 'armedstay'; }
    else if (flags.armed_away) { return 'armedaway'; }
    else if (flags.disarmed) { return 'ready'; }
    else if (!flags.disarmed) { return 'notready'; }
    return 'unknown';
  }

  function getZoneBySerial(serial) {
    var zones = nconf.get('ad2usb:panelConfig:zones');
    return zones.find(zone => zone.serial === serial);
  }

  /**
   * Constants
   */
  var VIRTUAL_KEYPAD_BEEP = {
    '0' : 'off',
    '1' : 'beep 1 time',
    '2' : 'beep 2 times',
    '3' : 'beep 3 times',
    '4' : 'continous fast beep',
    '5' : 'continuous slow beep'
  };

  var RFX_FLAG = {
    UNKNOWN: 1,
    LOW_BATTERY: 2,
    SUPERVISION: 4,
    UNKNOWN: 8,
    LOOP3: 16,
    LOOP2: 32,
    LOOP4: 64,
    LOOP1: 128
  };
}
