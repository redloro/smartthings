/**
 *  SmartThings Device Handler: Russound Zone
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
metadata {
  definition (name: "Russound Zone", namespace: "redloro-smartthings", author: "redloro@gmail.com") {

    /**
     * List our capabilties. Doing so adds predefined command(s) which
     * belong to the capability.
     */
    capability "Music Player"
    capability "Switch"
    capability "Refresh"
    capability "Polling"

    /**
     * Define all commands, ie, if you have a custom action not
     * covered by a capability, you NEED to define it here or
     * the call will not be made.
     *
     * To call a capability function, just prefix it with the name
     * of the capability, for example, refresh would be "refresh.refresh"
     */
    command "source0"
    command "source1"
    command "source2"
    command "source3"
    command "source4"
    command "source5"
    command "loudnessOn"
    command "loudnessOff"
    command "allOff"
    command "zone"
  }

  /**
   * Define the various tiles and the states that they can be in.
   * The 2nd parameter defines an event which the tile listens to,
   * if received, it tries to map it to a state.
   *
   * You can also use ${currentValue} for the value of the event
   * or ${name} for the name of the event. Just make SURE to use
   * single quotes, otherwise it will only be interpreted at time of
   * launch, instead of every time the event triggers.
   */
  tiles(scale: 2) {
    multiAttributeTile(name:"state", type:"generic", width:6, height:4) {
      tileAttribute ("device.switch", key: "PRIMARY_CONTROL") {
        attributeState "on", label:'On', action:"switch.off", icon:"st.Electronics.electronics16", backgroundColor:"#79b821", nextState:"off"
        attributeState "off", label:'Off', action:"switch.on", icon:"st.Electronics.electronics16", backgroundColor:"#ffffff", nextState:"on"
      }
      tileAttribute ("source", key: "SECONDARY_CONTROL") {
        attributeState "source", label:'${currentValue}'
      }
    }

    // Row 1
    controlTile("volume", "device.volume", "slider", height: 2, width: 6, range:"(0..100)") {
      state "volume", label: "Volume", action:"music Player.setLevel", backgroundColor:"#ffffff"
    }

    // Row 2-3
    standardTile("0", "device.source0", decoration: "flat", width: 2, height: 2) {
      state("off", label:"Source 1", action:"source0", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-gray.png", backgroundColor:"#ffffff")
      state("on", label:"Source 1", action:"source0", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-green.png", backgroundColor:"#ffffff")
    }
    standardTile("1", "device.source1", decoration: "flat", width: 2, height: 2) {
      state("off", label:"Source 2", action:"source1", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-gray.png", backgroundColor:"#ffffff")
      state("on", label:"Source 2", action:"source1", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-green.png", backgroundColor:"#ffffff")
    }
    standardTile("2", "device.source2", decoration: "flat", width: 2, height: 2) {
      state("off", label:"Source 3", action:"source2", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-gray.png", backgroundColor:"#ffffff")
      state("on", label:"Source 3", action:"source2", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-green.png", backgroundColor:"#ffffff")
    }
    standardTile("3", "device.source3", decoration: "flat", width: 2, height: 2) {
      state("off", label:"Source 4", action:"source3", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-gray.png", backgroundColor:"#ffffff")
      state("on", label:"Source 4", action:"source3", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-green.png", backgroundColor:"#ffffff")
    }
    standardTile("4", "device.source4", decoration: "flat", width: 2, height: 2) {
      state("off", label:"Source 5", action:"source4", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-gray.png", backgroundColor:"#ffffff")
      state("on", label:"Source 5", action:"source4", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-green.png", backgroundColor:"#ffffff")
    }
    standardTile("5", "device.source5", decoration: "flat", width: 2, height: 2) {
      state("off", label:"Source 6", action:"source5", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-gray.png", backgroundColor:"#ffffff")
      state("on", label:"Source 6", action:"source5", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-green.png", backgroundColor:"#ffffff")
    }

    // Row 4
    standardTile("loudness", "device.loudness", decoration: "flat", width: 2, height: 2) {
      state("off", label:'Loudness', action:"loudnessOn", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-gray.png", backgroundColor:"#ffffff")
      state("on", label:'Loudness', action:"loudnessOff", icon:"https://raw.githubusercontent.com/redloro/smartthings/master/images/indicator-dot-green.png", backgroundColor:"#ffffff")
    }
    standardTile("alloff", "device.status", decoration: "flat", width: 2, height: 2, inactiveLabel: false) {
      state "default", action:"allOff", icon:"st.thermostat.heating-cooling-off", backgroundColor:"#ffffff"
    }
    standardTile("refresh", "device.status", width: 2, height: 2, inactiveLabel: false, decoration: "flat") {
      state "default", label:"", action:"refresh.refresh", icon:"st.secondary.refresh", backgroundColor:"#ffffff"
    }

    // Defines which tile to show in the overview
    main "state"

    // Defines which tile(s) to show when user opens the detailed view
    details([
      "state",
      "volume",
      "0","1","2","3","4","5",
      "loudness", "alloff","refresh"
    ])
  }
}

/**************************************************************************
 * The following section simply maps the actions as defined in
 * the metadata into onAction() calls.
 *
 * This is preferred since some actions can be dealt with more
 * efficiently this way. Also keeps all user interaction code in
 * one place.
 *
 */
def on() { sendCommand("/state/1") }
def off() { sendCommand("/state/0") }
def source0() { sendCommand("/source/0") }
def source1() { sendCommand("/source/1") }
def source2() { sendCommand("/source/2") }
def source3() { sendCommand("/source/3") }
def source4() { sendCommand("/source/4") }
def source5() { sendCommand("/source/5") }
def setLevel(value) { sendCommand("/volume/${(value/2).intValue()}") }
def loudnessOn() { sendCommand("/loudness/1") }
def loudnessOff() { sendCommand("/loudness/0") }
def allOff() { sendCommand("/all/0") }
def refresh() { sendCommand("") }
/**************************************************************************/

/**
 * Called every so often (every 5 minutes actually) to refresh the
 * tiles so the user gets the correct information.
 */
def poll() {
  refresh()
}

def zone(evt) {
  /*
  * Zone On/Off state (0x00 = OFF or 0x01 = ON)
  */
  if (evt.containsKey("state")) {
    //log.debug "setting state to ${result.state}"
    sendEvent(name: "switch", value: (evt.state == 1) ? "on" : "off")
  }

  /*
  * Zone Volume level (0x00 - 0x32, 0x00 = 0 ... 0x32 = 100 Displayed)
  */
  if (evt.containsKey("volume")) {
    //log.debug "setting volume to ${result.volume * 2}"
    sendEvent(name: "volume", value: evt.volume * 2)
  }

  /*
  * Zone Loudness (0x00 = OFF, 0x01 = ON )
  */
  if (evt.containsKey("loudness")) {
    //log.debug "setting loudness to ${result.loudness}"
    sendEvent(name: "loudness", value: (evt.loudness == 1) ? "on" : "off")
  }

  /*
  * Zone Source selected (0-5)
  */
  if (evt.containsKey("source")) {
    //log.debug "setting source to ${result.source}"
    for (def i = 0; i < 6; i++) {
      if (i == evt.source) {
        sendEvent(name: "source${i}", value: "on")
        sendEvent(name: "source", value: "Source ${i+1}: ${evt.sourceName}")
      }
      else {
        sendEvent(name: "source${i}", value: "off")
      }
    }
  }
}

private sendCommand(part) {
  def id = new String(device.deviceNetworkId).tokenize('|')[1].replace('zone', '')
  parent.sendCommand("/plugins/rnet/zones/${id}${part}")
}