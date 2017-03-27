/**
 *  Amazon Dash Button Plugin
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
 *  https://community.smartthings.com/t/hack-the-amazon-dash-button-to-control-a-smartthings-switch/20427
 *  https://github.com/hortinstein/node-dash-button
 *
 *  npm install https://github.com/mranney/node_pcap.git
 *  sudo node server.js
 */
var express = require('express');
var pcap = require('pcap');
var stream = require('stream');
var app = express();
var nconf = require('nconf');
var notify;
var logger = function(str) {
  mod = 'dash';
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Routes
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: 'Amazon Dash Button plugin running' });
});
app.get('/discover/:timeout', function (req, res) {
  dash.discover(req.params.timeout);
  res.end();
});

module.exports = function(f) {
  notify = f;
  return app;
};

/**
 * DashButton
 */
var dash = new DashButton();
dash.init();

function DashButton() {
  /**
   * init (REQUIRED)
   */
  this.init = function() {
    if (!nconf.get('dash:buttons')) {
      logger('** NOTICE ** Dash Button addresses not set in config file!');
      this.discover(60);
      return;
    }

    register(nconf.get('dash:buttons'));
    return;
  };

  /**
   * discover
   */

  this.discover = function(timeout) {
    var pcap = require('pcap');
    var pcap_session = create_session(null);
    if (!pcap_session) { return; }

    logger('Discovering Dash Buttons on local network...');
    var just_emitted = [];
    pcap_session.on('packet', function(raw) {
      var packet = pcap.decode.packet(raw);

      if(packet.payload.ethertype === 2054 || packet.payload.ethertype === 2048) {
        var address = getMAC(packet);
        var protocol = (packet.payload.ethertype === 2054) ? 'arp' : 'udp';

        // only report udp broadcasts
        if (protocol === 'arp') { return; }

        if (!just_emitted[address]) {
          setTimeout(function() { just_emitted[address] = false; }, 5000);
          just_emitted[address] = true;

          var data = { address: address, protocol: protocol };
          logger(JSON.stringify(data));
          //notify(JSON.stringify(data));
        }
      }
    });

    setTimeout(function() { logger('Finished discovery on local network'); pcap_session.close(); }, (timeout || 10)*1000);
  };

  /**
   * Helper Functions
   */

  function register(addresses, iface, timeout) {
    addresses = (Array.isArray(addresses)) ? addresses : [addresses];
    timeout = timeout || 5000;

    var just_emitted = {};
    addresses.forEach(function(mac) {
      just_emitted[mac] = false;
    });

    var pcap_session = create_session(iface);
    pcap_session.on('packet', function(raw) {
      var packet;
      try {
        packet = pcap.decode.packet(raw);
      } catch (err) {
        return;
      }

      if (packet.payload.ethertype === 2054 || packet.payload.ethertype === 2048) {
        var address = getMAC(packet);
        if (addresses.indexOf(address) !== -1 && !just_emitted[address]) {
          setTimeout(function() { just_emitted[address] = false; }, timeout);
          just_emitted[address] = true;

          var data = { address: address, status: 'active' };
          logger(JSON.stringify(data));
          notify(JSON.stringify(data));
        }
      }
    });
  };

  function create_session(iface) {
    var session;
    try {
      session = pcap.createSession(iface, 'arp or ( udp and ( port 67 or port 68 ) )');
    } catch (err) {
      logger('Failed to create pcap session: no devices to listen on...');
      logger(err);
    }
    return session;
  }

  function getMAC(packet) {
    return (packet.payload.ethertype === 2054) ?
      int_array_to_hex(packet.payload.payload.sender_ha.addr) :
      int_array_to_hex(packet.payload.shost.addr);
  }

  function int_array_to_hex(int_array) {
    var hex = '';
    for (var i in int_array) {
      var h = int_array[i].toString(16);
      if (h.length < 2) {h = '0' + h};
      if (i !== int_array.length) {hex+=":"};
      hex += h;
    }
    return hex.slice(1);
  }
}
