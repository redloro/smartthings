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
 *  UPDATE 01/06/2018
 *  - Switched to mscdex/cap: https://github.com/mscdex/cap
 * 
 *  https://community.smartthings.com/t/hack-the-amazon-dash-button-to-control-a-smartthings-switch/20427
 *  https://github.com/hortinstein/node-dash-button
 *  
 *  npm install cap
 *  sudo node server.js
 */
var express = require('express');
var pcap = require('cap').Cap;
var pcap_decoders = require('cap').decoders;
var buffer = new Buffer(65535);
var util = require('util');
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

    register(nconf.get('dash:buttons'), nconf.get('dash:iface'));
    return;
  };

  /**
   * discover
   */

  this.discover = function(timeout) {
    logger('Network devices...');
    logger(util.inspect(pcap.deviceList(), false, null));
    var iface = nconf.get('dash:iface') || pcap.findDevice();

    logger(`Discovering Dash Buttons on local network with iface [${iface}]...`);
    var pcap_session = create_session(iface);
    
    var just_emitted = [];
    pcap_session.on('packet', function(nbytes, trunc) {
      var ret = pcap_decoders.Ethernet(buffer);
      var packet = pcap_decoders.ARP(buffer, ret.offset);

      var address = packet.info.sendermac;
      var protocol = (packet.info.protocol === 2054) ? 'arp' : 'udp';

      if (address !== '' && !just_emitted[address]) {
        setTimeout(function() { just_emitted[address] = false; }, 5000);
        just_emitted[address] = true;

        var data = { address: address, protocol: protocol };
        logger(JSON.stringify(data));
        //notify(JSON.stringify(data));
      }
    });

    setTimeout(function() { logger('Finished discovery on local network'); pcap_session.close(); }, (timeout || 10)*1000);
  };

  /**
   * Helper Functions
   */

  function register(addresses, iface, timeout) {
    addresses = (Array.isArray(addresses)) ? addresses : [addresses];
    iface = iface || pcap.findDevice();
    timeout = timeout || 5000;

    var just_emitted = {};
    addresses.forEach(function(mac) {
      just_emitted[mac] = false;
    });

    var pcap_session = create_session(iface);
    pcap_session.on('packet', function(nbytes, trunc) {
      var ret = pcap_decoders.Ethernet(buffer);
      var packet = pcap_decoders.ARP(buffer, ret.offset);

      if (packet.info.protocol === 2054 || packet.info.protocol === 2048) {
        var address = packet.info.sendermac;
        if (address !== '' && addresses.indexOf(address) !== -1 && !just_emitted[address]) {
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
    var session = new pcap();
    try {
      session.open(iface, 'arp or ( udp and ( port 67 or port 68 ) )', 10 * 1024 * 1024, buffer);
      session.setMinBytes && session.setMinBytes(0);
    } catch (err) {
      logger('Failed to create pcap session: no devices to listen on...');
      logger(err);
    }
    return session;
  }
}