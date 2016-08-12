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

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: 'Envisalink Vista TPI plugin running' });
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

app.get('/disarm', function (req, res) {
  if (nconf.get('envisalink:securityCode')) {
    evl.command(nconf.get('envisalink:securityCode')+'1');
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
      console.log('Configuration error: '+err.message);
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
  var panel = {alpha: '', partitions: [], zones: []};
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
        console.log('** NOTICE ** Envisalink settings not set in config file!');
        return;
    }

    if (device && device.writable) { return; }
    if (device) { device.destroy(); }
    
    device = new net.Socket();
    device.on('error', function(err) {
      console.log("Envisalink connection error: "+err.description);
      device.destroy();
      setTimeout(self.init(), 4000);
    });

    device.on('close', function() {
      console.log('Envisalink connection closed.');
      device.destroy();
      setTimeout(self.init(), 4000);
    });

    device.on('data', function (data) {
      data.toString('utf8').split(/\r?\n/).forEach( function (item) {
          read(item);
      });
    });

    device.connect(nconf.get('envisalink:port'), nconf.get('envisalink:address'), function() {
      console.log('Connected to Envisalink at %s:%s', nconf.get('envisalink:address'), nconf.get('envisalink:port'));
    });
  };

  // check connection every 60 secs
  setInterval(function() { self.init(); }, 60*1000);

  /**
   * write
   */
  function write(cmd) {
    if (!device || !device.writable) {
      console.log('Envisalink not connected.');
      return;
    }

    if (!cmd || cmd.length == 0) { return; }
    //console.log('TX > '+cmd);
    device.write(cmd);
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
    //console.log('RX < '+data);

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
      responseHandler = RESPONSE_TYPES[code]['handler'];
      responseHandler(data);
    }
  }

  /**
   * Discovery Handlers
   */
  var count = 0;
  var zones = [];
  var outputs = [];

  this.discover = function() {
    if (!nconf.get('envisalink:installerCode') || nconf.get('envisalink:installerCode').length == 0) {
      if (nconf.get('envisalink:panelConfig')) {
        notify(JSON.stringify(nconf.get('envisalink:panelConfig')));
        console.log('Completed panel discovery');
      } else {
        console.log('** NOTICE ** Panel configuration not set in config file!');
      }
      return;
    }

    //lock writing during auto-discovery
    locked = true;

    //console.log('Begin panel discovery');
    //console.log('Request programming mode');
    requestHandler(nconf.get('envisalink:installerCode')+'800', 'Installer', function(data) {
      //console.log('Request field data');
      requestHandler('*', 'Field', function(data) {
        //console.log('Request zone data');
        requestHandler('*56*', 'Enter Zn', function(data) {
          addZones();
        });
      });
    });
  };

  function addZones() {
    // load max 20 zones
    if (count == 20) {
      //console.log('Exit zone programming');
      //console.log('Dump all zones: '+ JSON.stringify(zones));
      requestHandler('00', 'Enter *', function(data) {
        if (zones.length) {
          //console.log('Request alpha programming');
          requestHandler('*8210', '* Zn ', function(data) {
            count = 0;
            addZonesAlpha();
          });
        }
      });
      return;
    }

    //console.log('Request next zone');
    requestHandler('*', 'Zn ZT', function(data) {
      zones.push(getZone(data));
      count++;

      requestHandler('#', 'Enter Zn', function(data) {
        addZones();
      });
    });
  }

  function addZonesAlpha() {
    if (count == zones.length) {
      //console.log('Exit zone alpha programming');
      //console.log('Dump all zones: '+ JSON.stringify(zones));
      requestHandler('*00', 'Program Alpha', function(data) {
        //console.log('Exit alpha programming');
        requestHandler('0', 'Enter', function(data) {
          //console.log('Request output programming');
          requestHandler('*79', 'Enter Output', function(data) {
            count = 0;
            addOutputs();
          });
        });
      });
      return;
    }

    //console.log('Dump zone: '+ JSON.stringify(zones[count]));
    //console.log('Request alpha for zone: '+zones[count].display);
    var cmd = (count == 0) ? '' : zones[count].display;
    requestHandler('*'+cmd, '* Zn '+zones[count].display, function(data) {
      var alpha = data.substring(23,30).trim()+' '+data.substring(30,46).trim();
      zones[count].alpha = toTitleCase(alpha.trim());
      count++;

      addZonesAlpha();
    });
  }

  function addOutputs() {
    if (count == 16) {
      //console.log('Exit output programming');
      //console.log('Dump all outputs: '+ JSON.stringify(outputs));
      requestHandler('00', 'Enter ', function(data) {
        //console.log('Exit programming mode');
        requestHandler('*99', 'Enter *', function(data) {
          count = 0;
          locked = false;

          //Remove empty zones
          for (var i = 0; i < zones.length; i++){
            if (zones[i].type == 0) {
              zones.splice(i, 1);
              i--;
            }
          }

          // notify
          notify(JSON.stringify({
            type: 'discover',
            partitions: [{partition: 1, name: 'Security Panel'}],
            zones: zones}));
          console.log('Completed panel discovery');

          //console.log('Dump all zones: '+ JSON.stringify(zones));
          //console.log('Dump all outputs: '+ JSON.stringify(outputs));
          requestHandler(null, null, null);
        });
      });
      return;
    }

    var cmd = ("0" + (count+1)).slice(-2);
    //console.log('Request output: '+cmd);
    requestHandler(cmd+'*', 'Output Type', function(data) {
      //console.log('output data: '+data);
      if ("0" != data.substring(45,46)) {
        outputs.push(getOutput(cmd, data));
      }
      requestHandler('#', 'Enter Output', function(data) {
        count++;
        addOutputs();
      });
    });
  }

  function getZone(data) {
    var zone = {};
    zone.number = parseInt(data.substring(8, 10));
    zone.display = data.substring(30,32);
    zone.type = parseInt(data.substring(33,35));
    zone.partition = parseInt(data.substring(36,37));
    //zone.reportCode = data.substring(38,40);
    //zone.hwin = data.substring(25,27);
    //zone.adlp = data.substring(28,30);
    //zone.hw_in = data.substring(41,43);
    //zone.ht_lp = data.substring(44,46);
    return zone;
  }

  function getOutput(cmd, data) {
    return {
      output: cmd,
      type: data.substring(30,45).trim(),
      typeNum: data.substring(45,46)
    };
  }

  /**
   * Generic Handlers
   */
  function login() {
    //console.log('Execute login');
    write(nconf.get('envisalink:password'));
  }

  function keypad_update(data) {
    //console.log('Execute keypad_update: '+data);

    var map = data.split(',');
    if (map.length != 5 || data.indexOf('%') != -1) {
      console.log("Data format invalid from Envisalink, ignoring...")
      return;
    }

    var msg = {};
    msg.partitionNumber = parseInt(map[0]);
    msg.flags = getLedFlag(map[1]);
    msg.userOrZone = parseInt(map[2]);
    msg.beep = VIRTUAL_KEYPAD_BEEP[map[3]];
    msg.alpha = map[4].trim();
    msg.dscCode = getDscCode(msg.flags);
    //console.log(JSON.stringify(msg));

    //////////
    // ZONE UPDATE
    //////////
    if (msg.dscCode == 'READY') {
      for (var n in panel.zones){
        if (panel.zones[n] != 'closed') {
          panel.zones[n] = 'closed';

          // notify
          notify(JSON.stringify({type: 'zone', partition: msg.partitionNumber, zone: parseInt(n), state: 'closed'}));
          console.log(JSON.stringify({type: 'zone', partition: msg.partitionNumber, zone: parseInt(n), state: 'closed'}));
        }
      }
    }

    if (msg.dscCode == '' && !isNaN(msg.userOrZone)) {
      // determine if this is a new message
      if (panel.zones[msg.userOrZone] != 'open') {
        // persist panel status
        panel.zones[msg.userOrZone] = 'open';

        // notify
        notify(JSON.stringify({type: 'zone', partition: msg.partitionNumber, zone: msg.userOrZone, state: 'open'}));
        console.log(JSON.stringify({type: 'zone', partition: msg.partitionNumber, zone: msg.userOrZone, state: 'open'}));
      }
    }

    if (msg.dscCode == 'IN_ALARM' && !isNaN(msg.userOrZone)) {
      // determine if this is a new message
      if (panel.zones[msg.userOrZone] != 'alarm') {
        // persist panel status
        panel.zones[msg.userOrZone] = 'alarm';

        // notify
        notify(JSON.stringify({type: 'zone', partition: msg.partitionNumber, zone: msg.userOrZone, state: 'alarm'}));
        console.log(JSON.stringify({type: 'zone', partition: msg.partitionNumber, zone: msg.userOrZone, state: 'alarm'}));
      }
    }

    //////////
    // PARTITION UPDATE
    //////////
    if (panel.alpha != msg.alpha) {
      panel.alpha = msg.alpha;
      var partitionState = getPartitionState(msg.flags);

      //notify
      notify(JSON.stringify({type: 'partition', partition: msg.partitionNumber, state: partitionState, alpha: msg.alpha}));
      console.log(JSON.stringify({type: 'partition', partition: msg.partitionNumber, state: partitionState, alpha: msg.alpha}));
    }
  }

  function login_success() {
    //console.log('Execute login_success');
  }

  function login_failure() {
    //console.log('Execute login_failure');
  }

  function login_timeout() {
    //console.log('Execute login_timeout');
  }

  function zone_state_change(data) {
    //console.log('Execute zone_state_change: '+data);
  }

  function partition_state_change(data) {
    //console.log('Execute partition_state_change: '+data);
  }

  function realtime_cid_event(data) {
    //console.log('Execute realtime_cid_event: '+data);
  }

  function zone_timer_dump(data) {
    //console.log('Execute zone_timer_dump: '+data);
  }

  function poll_response(data) {
    //console.log('Execute poll_response: '+data);
  }

  function command_response(data) {
    //console.log('Execute command_response: '+data);
  }

  /**
   * Helper Functions
   */
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

  function getPartitionState(flags) {
    if (flags.alarm || flags.alarm_fire_zone || flags.fire) { return 'alarm'; }
    else if (flags.alarm_in_memory) { return 'alarmcleared'; }
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
