/**
 *  Envisalink Vista TPI Plugin
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
 *  Many thanks to these guys:
 *   GetVera Plugin: EVL3Vista_4.0.1_EVL/L_EVL3VistaAlarmPanel1.lua
 *   http://forum.eyez-on.com/FORUM/viewtopic.php?f=6&t=301
 *   https://github.com/kholloway/smartthings-dsc-alarm
 *   https://github.com/MattTW/HoneyAlarmServer
 *   https://github.com/oehokie/SmartDSC
 *   https://github.com/oehokie/NodeAlarmProxy
 */
var express = require('express');
var net = require('net');
var app = express();
var nconf = require('nconf');
nconf.file({ file: './config.json' });
var notify;
var logger = function(str) {
  mod = 'evl3';
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: 'Envisalink Vista TPI plugin running' });
});

app.get('/disarm', function (req, res) {
  if (nconf.get('envisalink:securityCode')) {
    evl.command(nconf.get('envisalink:securityCode')+'1');
  }
  res.end();
});

app.get('/armAway', function (req, res) {
  if (nconf.get('envisalink:securityCode')) {
    evl.command(nconf.get('envisalink:securityCode')+'2');
  }
  res.end();
});

app.get('/armStay', function (req, res) {
  if (nconf.get('envisalink:securityCode')) {
    evl.command(nconf.get('envisalink:securityCode')+'3');
  }
  res.end();
});

app.get('/armInstant', function (req, res) {
  if (nconf.get('envisalink:securityCode')) {
    evl.command(nconf.get('envisalink:securityCode')+'7');
  }
  res.end();
});

app.get('/chime', function (req, res) {
  if (nconf.get('envisalink:securityCode')) {
    evl.command(nconf.get('envisalink:securityCode')+'9');
  }
  res.end();
});

app.get('/trigger/:output', function (req, res) {
  if (nconf.get('envisalink:securityCode')) {
    if (req.params.output === '17' || req.params.output === '18') {
      evl.command(nconf.get('envisalink:securityCode')+'#7'+req.params.output);
      setTimeout(function() {
        evl.command(nconf.get('envisalink:securityCode')+'#8'+req.params.output);
      }, 2000);
    }
  }
  res.end();
});

app.get('/bypass/:zones', function (req, res) {
  if (nconf.get('envisalink:securityCode')) {
    var zones = req.params.zones.split(',').map(function(x) {
      x = ('00'+x.trim()).slice(-2);
      return (x === '00') ? '' : x;
    }).join('');

    if (zones) {
      evl.command(nconf.get('envisalink:securityCode')+'6'+zones);
    }
  }
  res.end();
});

app.get('/config/:host', function (req, res) {
  var parts = req.params.host.split(":");
  nconf.set('envisalink:address', parts[0]);
  nconf.set('envisalink:port', parts[1]);
  nconf.set('envisalink:password', parts[2]);
  nconf.set('envisalink:securityCode', parts[3]);
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
  evl.discover();
  res.end();
});

app.get('/command/:cmd', function (req, res) {
  //BE CAREFUL
  //evl.command(req.params.cmd);
  res.end();
});

module.exports = function(f) {
  notify = f;
  return app;
};

/**
 * Envisalink
 */
var evl = new Envisalink();
evl.init();

function Envisalink () {
  var self = this;
  var locked = false;
  var panel = {alpha: '', timer: [], partition: 1, zones: []};
  var device = null;
  var deviceRequest = null;
  var deviceResponse = null;
  var responseHandler = function() {};
  var requestHandler = function(a, b, c) {
    deviceRequest = a;
    deviceResponse = b;
    responseHandler = c;
    write(deviceRequest);
  };

  /**
   * init
   */
  this.init = function() {
    if (!nconf.get('envisalink:address') || !nconf.get('envisalink:port') || !nconf.get('envisalink:password')) {
        logger('** NOTICE ** Envisalink settings not set in config file!');
        return;
    }

    if (device && device.writable) { return; }
    if (device) { device.destroy(); }

    device = new net.Socket();
    device.on('error', function(err) {
      logger("Envisalink connection error: "+err.description);
      device.destroy();
      setTimeout(function() { self.init() }, 4000);
    });

    device.on('close', function() {
      logger('Envisalink connection closed.');
      device.destroy();
      setTimeout(function() { self.init() }, 4000);
    });

    device.on('data', function (data) {
      data.toString('utf8').split(/\r?\n/).forEach( function (item) {
          read(item);
      });
    });

    device.connect(nconf.get('envisalink:port'), nconf.get('envisalink:address'), function() {
      logger('Connected to Envisalink at '+nconf.get('envisalink:address')+':'+nconf.get('envisalink:port'));
    });
  };

  // check connection every 60 secs
  setInterval(function() { self.init(); }, 60*1000);

  // experimental: dump zone timers
  var zoneTimer = (nconf.get('envisalink:dumpZoneTimer')) ? parseInt(nconf.get('envisalink:dumpZoneTimer')) : 0;
  if (zoneTimer > 0) {
    setInterval(function() { write('^02,$'); }, 60*1000*zoneTimer);
  }

  /**
   * write
   */
  function write(cmd) {
    if (!device || !device.writable) {
      logger('Envisalink not connected.');
      return;
    }

    if (!cmd || cmd.length == 0) { return; }
    //logger('TX > '+cmd);
    device.write(cmd+'\n');
  }

  this.command = function(cmd) {
    if (locked) { return; }
    write(cmd);
  };

  /**
   * read
   */
  function read(data) {
    if (data.length == 0) { return; }
    //logger('RX < '+data);

    var code = data;
    if (data[0] == '%' || data[0] == '^') {
      code = data.split(',')[0];
      data = data.slice(data.indexOf(',')+1,-1);
    }

    // defined device response handler
    if (responseHandler && deviceResponse) {
      var match = data.indexOf(deviceResponse);
      if (match != -1) {
        responseHandler(data);
      }
    } else {
      // generic handler
      if (RESPONSE_TYPES[code]) {
        responseHandler = RESPONSE_TYPES[code]['handler'];
        responseHandler(data);
      } else {
        logger("Error: ignoring invalid message code from Envisalink: "+code+", data: "+data);
      }
    }
  }

  /**
   * discover
   */
  this.discover = function() {
    if (nconf.get('envisalink:panelConfig')) {
      notify(JSON.stringify(nconf.get('envisalink:panelConfig')));
      logger('Completed panel discovery');
    } else {
      logger('** NOTICE ** Panel configuration not set in config file!');
    }

    //never do auto-discovery
    return;
  };

  /**
   * Generic Handlers
   */
  function login() {
    //logger('Execute login');
    write(nconf.get('envisalink:password'));
  }

  function keypad_update(data) {
    //logger('Execute keypad_update: '+data);

    var map = data.split(',');
    if (map.length != 5 || data.indexOf('%') != -1) {
      logger("Error: ignoring invalid data format from Envisalink: "+data)
      return;
    }

    var msg = {};
    msg.partitionNumber = parseInt(map[0]);
    msg.flags = getLedFlag(map[1]);
    msg.userOrZone = parseInt(map[2]);
    msg.beep = VIRTUAL_KEYPAD_BEEP[map[3]];
    msg.alpha = map[4].trim();
    msg.dscCode = getDscCode(msg.flags);
    //logger(JSON.stringify(msg));
    //logger(JSON.stringify(panel));

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
    if (msg.dscCode == '' && !isNaN(msg.userOrZone)) {
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
    if (msg.dscCode == 'IN_ALARM' && !isNaN(msg.userOrZone)) {
      if (panel.zones[msg.userOrZone] != 'alarm') {
        // notify
        updateZone(msg.partitionNumber, msg.userOrZone, 'alarm');
      }
    }

    //////////
    // PARTITION UPDATE
    //////////
    if (panel.alpha != msg.alpha) {
      //notify
      updatePartition(msg.partitionNumber, getPartitionState(msg.flags, msg.alpha), msg.alpha);
    }
  }

  function login_success() {
    //logger('Execute login_success');
  }

  function login_failure() {
    //logger('Execute login_failure');
  }

  function login_timeout() {
    //logger('Execute login_timeout');
  }

  function zone_state_change(data) {
    //logger('Execute zone_state_change: '+data);
  }

  function partition_state_change(data) {
    //logger('Execute partition_state_change: '+data);
  }

  function realtime_cid_event(data) {
    //logger('Execute realtime_cid_event: '+data);
  }

  function zone_timer_dump(data) {
    //logger('Execute zone_timer_dump: '+data);
    var queue = [];

    // Swap the couples of every four bytes (little endian to big endian)
    for (var i=0; i<data.length; i+=4) {
      var zoneTimer = data[i+2]+data[i+3]+data[i]+data[i+1];

      var msg = {};
      msg.zoneNumber = (i/4)+1;
      msg.zoneTimer = (parseInt('FFFF', 16) - parseInt(zoneTimer, 16)) * 5;

      // zone timer over 30 secs will be considered closed
      msg.zoneStatus = (msg.zoneTimer < 30) ? 'open' : 'closed';

      // use zone timer dump as backup to check for orphaned zones
      if (msg.zoneStatus == 'closed' &&
          panel.zones[msg.zoneNumber] != 'closed') {
        // notify
        queue.push({
          partition: panel.partition,
          zoneNumber: msg.zoneNumber,
          state: 'closed'
        });
      }
      //logger(JSON.stringify(msg));
    }

    updateThrottler(queue);
  }

  function poll_response(data) {
    //logger('Execute poll_response: '+data);
  }

  function command_response(data) {
    //logger('Execute command_response: '+data);
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

  function updateThrottler(queue) {
    var i = 0;
    while (queue.length) {
      var x = queue.pop();

      // notify
      updateZone(x.partition, x.zoneNumber, x.state);
      i++; if (i == 50) { break; }
    }

    if (!queue.length) { return; }

    setTimeout(function() { updateThrottler(queue) }, 5000);
  }

  function cleanBuffer(data) {
    //trim from response: 13,10
    data = (data[data.length-1]==10) ? data.slice(0,data.length-1) : data;
    data = (data[data.length-1]==13) ? data.slice(0,data.length-1) : data;
    return data.toString('utf8');
  }

  function lpad(val, len) {
    if (len < val.length) return val;

    var pad = "";
    for (var i = 0; i < len-val.length; i++) { pad += "0"; }

    return pad+val;
  }

  function getLedFlag(flag) {
    var flags = {};
    var flagInt = parseInt(flag, 16);
    for (var key in LED_FLAGS) {
      flags[key] = Boolean(LED_FLAGS[key] & flagInt);
    }
    return flags;
  }

  function getDscCode(flags) {
    var dscCode = '';
    if (flags.alarm || flags.alarm_fire_zone || flags.fire) { dscCode = 'IN_ALARM'; }
    else if (flags.system_trouble) { dscCode = 'NOT_READY'; }
    else if (flags.ready) { dscCode = 'READY'; }
    else if (flags.bypass) { dscCode = 'READY_BYPASS'; }
    else if (flags.armed_stay) { dscCode = 'ARMED_STAY'; }
    else if (flags.armed_away) { dscCode = 'ARMED_AWAY'; }
    else if (flags.armed_zero_entry_delay) { dscCode = 'ARMED_MAX'; }
    else if (flags.not_used2 && flags.not_used3) { dscCode = 'NOT_READY'; } // added to handle 'Hit * for faults'
    return dscCode;
  }

  function getPartitionState(flags, alpha) {
    if (flags.alarm || flags.alarm_fire_zone || flags.fire) { return 'alarm'; }
    else if (flags.alarm_in_memory) { return 'alarmcleared'; }
    else if (alpha.indexOf('You may exit now') > 0) { return 'arming'; }
    else if (flags.armed_stay && flags.armed_zero_entry_delay) { return 'armedinstant'; }
    else if (flags.armed_away && flags.armed_zero_entry_delay) { return 'armedmax'; }
    else if (flags.armed_stay) { return 'armedstay'; }
    else if (flags.armed_away) { return 'armedaway'; }
    else if (flags.ready) { return 'ready'; }
    else if (!flags.ready) { return 'notready'; }
    return 'unknown';
  }

  function toTitleCase(str)
  {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
  }

  /**
   * Constants
   */
  var RESPONSE_TYPES = {
    'Login:': {
      'name' : 'Login Prompt',
      'description' : 'Sent During Session Login Only.',
      'handler' : login },
    'OK': {
      'name' : 'Login Success',
      'description' : 'Send During Session Login Only, successful login',
      'handler' : login_success },
    'FAILED' : {
      'name' : 'Login Failure',
      'description' : 'Sent During Session Login Only, password not accepted',
      'handler' : login_failure },
    'Timed Out!' : {
      'name' : 'Login Interaction Timed Out',
      'description' : 'Sent during Session Login Only, socket connection is then closed',
      'handler' : login_timeout },
    '%00' : {
      'name' : 'Virtual Keypad Update',
      'description' : 'The panel wants to update the state of the keypad',
      'handler' : keypad_update },
    '%01' : {
      'name' : 'Zone State Change',
      'description' : 'A zone change-of-state has occurred',
      'handler' : zone_state_change,
      'type' : 'zone'},
    '%02' : {
      'name' : 'Partition State Change',
      'description' : 'A partition change-of-state has occured',
      'handler' : partition_state_change,
      'type' : 'partition' },
    '%03' : {
      'name' : 'Realtime CID Event',
      'description' : 'A system event has happened that is signaled to either the Envisalerts servers or the central monitoring station',
      'handler' : realtime_cid_event,
      'type' : 'system' },
    '%FF' : {
      'name' : 'Envisalink Zone Timer Dump',
      'description' : 'This command contains the raw zone timers used inside the Envisalink. The dump is a 256 character packed HEX string representing 64 UINT16 (little endian) zone timers. Zone timers count down from 0xFFFF (zone is open) to 0x0000 (zone is closed too long ago to remember). Each tick of the zone time is actually 5 seconds so a zone timer of 0xFFFE means 5 seconds ago. Remember, the zone timers are LITTLE ENDIAN so the above example would be transmitted as FEFF.',
      'handler' : zone_timer_dump },
    '^00' : {
      'name': 'Poll',
      'description' : 'Envisalink poll',
      'handler' : poll_response,
      'type' : 'envisalink' },
    '^01' : {
      'name': 'Change Default Partition',
      'description': 'Change the partition which keystrokes are sent to when using the virtual keypad.',
      'handler' : command_response,
      'type' : 'envisalink' },
    '^02' : {
      'name': 'Dump Zone Timers',
      'description' : 'This command contains the raw zone timers used inside the Envisalink. The dump is a 256 character packed HEX string representing 64 UINT16 (little endian) zone timers. Zone timers count down from 0xFFFF (zone is open) to 0x0000 (zone is closed too long ago to remember). Each tick of the zone time is actually 5 seconds so a zone timer of 0xFFFE means 5 seconds ago. Remember, the zone timers are LITTLE ENDIAN so the above example would be transmitted as FEFF.',
      'handler' : command_response,
      'type' : 'envisalink' },
    '^03' : {
      'name': 'Keypress to Specific Partition',
      'description' : 'This will send a keystroke to the panel from an arbitrary partition. Use this if you dont want to change the TPI default partition.',
      'handler' : command_response,
      'type' : 'envisalink' },
    '^0C' : {
      'name': 'Response for Invalid Command',
      'description' : 'This response is returned when an invalid command number is passed to Envisalink',
      'handler': command_response,
      'type' : 'envisalink' }
  };

  var VIRTUAL_KEYPAD_BEEP = {
    '00' : 'off',
    '01' : 'beep 1 time',
    '02' : 'beep 2 times',
    '03' : 'beep 3 times',
    '04' : 'continous fast beep',
    '05' : 'continuous slow beep'
  };

  var LED_FLAGS = {
    "alarm" : 1,
    "alarm_in_memory" : 2,
    "armed_away" : 4,
    "ac_present" : 8,
    "bypass" : 16,
    "chime" : 32,
    "not_used1" : 64,
    "armed_zero_entry_delay" : 128,
    "alarm_fire_zone" : 256,
    "system_trouble" : 512,
    "not_used2" : 1024,
    "not_used3" : 2048,
    "ready" : 4096,
    "fire" : 8192,
    "low_battery" : 16384,
    "armed_stay" : 32768
  };
}
