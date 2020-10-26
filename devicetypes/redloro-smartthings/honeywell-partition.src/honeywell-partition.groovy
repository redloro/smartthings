/**
 *  SmartThings Device Handler: Honeywell Partition
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
  definition (name: "Honeywell Partition", namespace: "redloro-smartthings", author: "redloro@gmail.com", ocfDeviceType: "x.com.st.d.remotecontroller", vid: "fc0c226e-fef6-3cc4-8a53-3757486920c1", mnmn: "SmartThingsCommunity") {
    capability "platinummassive43262.alarmState"
    capability "platinummassive43262.longMemo"
    capability "platinummassive43262.securityPartitionCommands"
    capability "Health Check"
    capability "Button"
    capability "Alarm"
    capability "Sensor"
    capability "Actuator"
    
    attribute "dscpartition", "enum", ["ready", "notready", "arming", "armedstay", "armedaway", "armedinstant", "armedmax", "alarmcleared", "alarm"]
    attribute "panelStatus", "String"

    command "partition"
    command "armStay"
    command "armAway"
    command "armInstant"
    command "disarm"
    command "armMax"
    command "armNight"
    command "trigger1"
    command "trigger2"
    command "keyA"
    command "keyB"
    command "keyC"
    command "keyD"
    command "chime"
    command "bypass"
  }

  tiles(scale: 2) {
    multiAttributeTile(name:"partition", type: "generic", width: 6, height: 4) {
      tileAttribute ("device.dscpartition", key: "PRIMARY_CONTROL") {
        attributeState "ready", label: 'Ready', icon:"st.Home.home2"
        attributeState "notready", label: 'Not Ready', backgroundColor: "#ffcc00", icon:"st.Home.home2"
        attributeState "arming", label: 'Arming', backgroundColor: "#ffcc00", icon:"st.Home.home3"
        attributeState "armedstay", label: 'Armed Stay', backgroundColor: "#79b821", icon:"st.Home.home3"
        attributeState "armedaway", label: 'Armed Away', backgroundColor: "#79b821", icon:"st.Home.home3"
        attributeState "armedinstant", label: 'Armed Instant Stay', backgroundColor: "#79b821", icon:"st.Home.home3"
        attributeState "armedmax", label: 'Armed Instant Away', backgroundColor: "#79b821", icon:"st.Home.home3"
        attributeState "alarmcleared", label: 'Alarm in Memory', backgroundColor: "#ffcc00", icon:"st.Home.home2"
        attributeState "alarm", label: 'Alarm', backgroundColor: "#ff0000", icon:"st.Home.home3"
      }
      tileAttribute ("panelStatus", key: "SECONDARY_CONTROL") {
        attributeState "panelStatus", label:'${currentValue}'
      }
    }

    standardTile("armAwayButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Away', action: "armAway", icon: "st.security.alarm.on", backgroundColor: "#79b821"
    }

    standardTile("armStayButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Stay', action: "armStay", icon: "st.security.alarm.on", backgroundColor: "#79b821"
    }

    standardTile("armInstantButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Instant', action: "armInstant", icon: "st.security.alarm.on", backgroundColor: "#79b821"
    }

    standardTile("disarmButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Disarm', action: "disarm", icon: "st.security.alarm.off", backgroundColor: "#C0C0C0"
    }

    standardTile("trigger1Button","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Trigger 1', action: "trigger1", icon: "st.Home.home30"
    }

    standardTile("trigger2Button","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Trigger 2', action: "trigger2", icon: "st.Home.home30"
    }

	standardTile("armMaxButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Max', action: "armMax", icon: "st.security.alarm.on", backgroundColor: "#79b821"
    }
    
    standardTile("armNightButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Night', action: "armNight", icon: "st.security.alarm.on", backgroundColor: "#79b821"
    }
    
    standardTile("chimeButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Chime', action: "chime", icon: "st.custom.sonos.unmuted"
    }

    standardTile("bypassButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Bypass', action: "bypass", icon: "st.locks.lock.unlocked"
    }
    
    standardTile("keyAButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Key A', action: "keyA", icon: "st.Home.home30"
    }
    
    standardTile("keyBButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Key B', action: "keyB", icon: "st.Home.home30"
    }
    
    standardTile("keyCButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Key C', action: "keyC", icon: "st.Home.home30"
    }
    
    standardTile("keyDButton","device.button", width: 2, height: 2, canChangeIcon: true, decoration: "flat") {
      state "default", label: 'Key D', action: "keyD", icon: "st.Home.home30"
    }

    main "partition"

    details(["partition",
             "armAwayButton", "armStayButton", "armInstantButton",
             "disarmButton", "armMaxButton", "armNightButton", //"trigger1Button", "trigger2Button",
             "keyAButton", "keyBButton", "keyCButton", "keyDButton",
             "chimeButton", "bypassButton"])
  }

  preferences {
    input name: "bypassZones", type: "text", title: "Bypass Zones", description: "Comma delimited list of zones to bypass", required: false
  }
}

def partition(String state, String alpha) {
  def altState = ""
  altState=getPrettyName().get(state)
  sendEvent (name: "dscpartition", value: "${state}", descriptionText: "${alpha}", displayed: false)
  sendEvent (name: "alarmState", value: "${altState}", descriptionText: "${alpha}", displayed: false)
  sendEvent (name: "partitionCommand", value: "${altState}", descriptionText: "${alpha}")
  sendEvent (name: "panelStatus", value: "${alpha}", displayed: false)
  sendEvent (name: "longMemo", value: "${alpha}")
}

def sendPartitionCommand(String arg) {
  log.debug "Processing: ${arg}"
  def prettyArg= ""
  prettyArg=getPrettyName().get(arg)
  sendEvent (name: "partitionCommand", value: "${prettyArg}", descriptionText: "Sending command ${arg}")
  if (arg=="bypass") arg="${arg}/${settings.bypassZones}"
  if (arg=="triggerOne") arg="trigger/17"
  if (arg=="triggerTwo") arg="trigger/17"
  parent.sendCommandPlugin("/${arg}")
}

def armAway() {
  sendPartitionCommand('armAway')
}

def armStay() {
  sendPartitionCommand('armStay')
}

def armMax() {
  sendPartitionCommand('armMax')
}

def armNight() {
  sendPartitionCommand('armNight')
}

def armInstant() {
  sendPartitionCommand('armInstant')
}

def disarm() {
  sendPartitionCommand('disarm')
}

def trigger1(){
  triggerOne()
}

def triggerOne() {
  sendPartitionCommand('triggerOne')
}

def trigger2(){
  triggerTwo()
}

def triggerTwo() {
  sendPartitionCommand('triggerTwo')
}

def chime() {
  sendPartitionCommand('chime')
}

def bypass() {
  sendPartitionCommand('bypass')
}

def keyA() {
  sendPartitionCommand('speedkey/A')
}

def keyB() {
  sendPartitionCommand('speedkey/B')
}

def keyC() {
  sendPartitionCommand('speedkey/C')
}

def keyD() {
  sendPartitionCommand('speedkey/D')
}

def getPrettyName()
{
	return [
    	ready: "Ready",
      notready: "Not Ready",
		  arming: "Arming",
      armedstay: "Armed Stay",
		  armedaway: "Armed Away",
		  armedinstant: "Armed Instant",
		  armedmax: "Armed Max",
		  alarmcleared: "Alarm Cleared",
      alarm: "Alarm",
      armAway: "Sending Arm Away",
      armStay: "Sending Arm Stay",
      armInstant: "Sending Arm Instant",
      disarm: "Sending Disarm",
      armMax: "Sending Arm Max",
      armNight: "Sending Arm Night",
      chime: "Sending Chime",
      bypass: "Sending Bypass",
      triggerOne: "Sending Trigger 1",
      triggerTwo: "Sending Trigger 2"
    ]
}
