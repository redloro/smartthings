/**
 *  SmartThings SmartApp: Honeywell Security
 *
 *  Author: redloro@gmail.com
 *  Modifications made by: jrodriguez142514-dev
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
 //***********Modifications Made By jrodriguez142514-dev***************
 
 
import groovy.json.JsonSlurper

definition(
  name: "Honeywell Security",
  namespace: "redloro-smartthings",
  author: "redloro@gmail.com",
  description: "Honeywell Security SmartApp",
  category: "Safety & Security",
  iconUrl: "https://raw.githubusercontent.com/redloro/smartthings/master/images/honeywell-security.png",
  iconX2Url: "https://raw.githubusercontent.com/redloro/smartthings/master/images/honeywell-security.png",
  iconX3Url: "https://raw.githubusercontent.com/redloro/smartthings/master/images/honeywell-security.png",
  singleInstance: true
)

preferences {
	page(name: "page1")
}

def page1() {
  dynamicPage(name: "page1", install: true, uninstall: true) {
    section("SmartThings Hub") {
	//***********Changes Made By jrodriguez142514-dev***************
      
      if (getHubID() == null){
            input(
                name		: "hostHub"
                ,type		: "hub"
                ,title		: "Select your hub"
                ,multiple		: false
                ,required		: true
                ,submitOnChange	: true
            )
            
            
         } else {
         	paragraph(getHubAddress())
         	paragraph("HUB ID: " + getHubID())
         }
	//***********Changes Made By jrodriguez142514-dev***************
    }
    section("SmartThings Node Proxy") {
      input "proxyAddress", "text", title: "Proxy Address", description: "(ie. 192.168.1.10)", required: true
      input "proxyPort", "text", title: "Proxy Port", description: "(ie. 8080)", required: true, defaultValue: "8080"
      input "authCode", "password", title: "Auth Code", description: "", required: true, defaultValue: "secret-key"
    }
    section("Honeywell Panel") {
      input name: "pluginType", type: "enum", title: "Plugin Type", required: true, submitOnChange: true, options: ["envisalink", "ad2usb"]
      input "securityCode", "password", title: "Security Code", description: "User code to arm/disarm the security panel", required: false
      input "resetZones", "bool", title: "Delete Existing Partitions/Zones During Discovery (WARNING: all existing zones will be removed)", required: false, defaultValue: false
      input "enableDiscovery", "bool", title: "Discover Zones", required: false, defaultValue: false
      if(state.installed) {
      	input "enableAutoDiscovery", "bool", title: "Automatically add missing zones when faulted", required: false, defaultValue: false
      }
    }

    if (pluginType == "envisalink") {
      section("Envisalink Vista TPI") {
        input "evlAddress", "text", title: "Host Address", description: "(ie. 192.168.1.11)", required: false
        input "evlPort", "text", title: "Host Port", description: "(ie. 4025)", required: false, defaultValue: "4025"
        input "evlPassword", "password", title: "Password", description: "", required: false
      }
    }

    section("Smart Home Monitor") {
      input "enableSHM", "bool", title: "Integrate with Smart Home Monitor", required: true, defaultValue: true
    }
    
    section("Logging") {
        input (
        	name: "configLoggingLevelIDE",
        	title: "IDE Live Logging Level:\nMessages with this level and higher will be logged to the IDE.",
        	type: "enum",
        	options: [
        	    "0" : "None",
        	    "1" : "Error",
        	    "2" : "Warning",
        	    "3" : "Info",
        	    "4" : "Debug",
        	    "5" : "Trace"
        	],
        	defaultValue: "3",
            displayDuringSetup: true,
        	required: false
        )
    }
  }
}

//***********Changes Made By jrodriguez142514-dev***************
def getHubID(){
    def hubID
    if (myHub){
        hubID = myHub.id
    } else {
        def hubs = location.hubs.findAll{ it.type == physicalgraph.device.HubType.PHYSICAL } 
        
        if (hubs.size() == 1) hubID = hubs[0].id 
    }
    
    return hubID
}
//***********Changes Made By jrodriguez142514-dev***************

//***********Changes Made By jrodriguez142514-dev***************
def getHubAddress(){
    def hubIP
    def hubPort
    def hubAddress
    if (myHub){
        hubIP = myHub.localIP
        hubPort = myHub.localSrvPortTCP
        hubAddress = hubIP + ":" + hubPort
    } else {
        def hubs = location.hubs.findAll{ it.type == physicalgraph.device.HubType.PHYSICAL } 
        
        if (hubs.size() == 1) {
        	hubIP = hubs[0].localIP
            hubPort = hubs[0].localSrvPortTCP
            hubAddress = hubIP + ":" + hubPort
        }
    }
    return hubAddress
}
//***********Changes Made By jrodriguez142514-dev***************

def installed() {
  state.loggingLevelIDE = 5
  state.installed = true
  subscribeToEvents()
}

def subscribeToEvents() {
  subscribe(location, null, lanResponseHandler, [filterEvents:false])
  subscribe(location, "alarmSystemStatus", alarmHandler)
}

def uninstalled() {
  removeChildDevices()
}

def updated() {
  state.loggingLevelIDE = (settings.configLoggingLevelIDE) ? settings.configLoggingLevelIDE.toInteger() : 3
  state.installed = true
  if (settings.enableDiscovery && settings.resetZones) {
    //remove child devices as we will reload
    logger("Deleting all existing partitions and zones to prepare for fresh discovery.","warn")
    removeChildDevices()
  }

  //subscribe to callback/notifications from STNP
  sendCommand('/subscribe/'+getNotifyAddress())

  //save envisalink settings to STNP config
  if (settings.pluginType == "envisalink" && settings.evlAddress && settings.evlPort && settings.evlPassword && settings.securityCode) {
    sendCommandPlugin('/config/'+settings.evlAddress+":"+settings.evlPort+":"+settings.evlPassword+":"+settings.securityCode)
  }

  //save ad2usb settings to STNP config
  if (settings.pluginType == "ad2usb" && settings.securityCode) {
    sendCommandPlugin('/config/'+settings.securityCode)
  }

  if (settings.enableDiscovery) {
    //delay discovery for 2 seconds
    logger("Running discovery in 2 seconds","info")
    runIn(2, discoverChildDevices)
    settings.enableDiscovery = false
  }
}

def lanResponseHandler(evt) {
  def map = stringToMap(evt.stringValue)

  //verify that this message is from STNP IP:Port
  //IP and Port are only set on HTTP GET response and we need the MAC
  if (map.ip == convertIPtoHex(settings.proxyAddress) &&
    map.port == convertPortToHex(settings.proxyPort)) {
      if (map.mac) {
        state.proxyMac = map.mac
      }
  }

  //verify that this message is from STNP MAC
  //MAC is set on both HTTP GET response and NOTIFY
  if (map.mac != state.proxyMac) {
    return
  }

  def headers = getHttpHeaders(map.headers);
  def body = getHttpBody(map.body);
  //logger("SmartThings Node Proxy: ${evt.stringValue}","trace")
  //logger("Headers: ${headers}","trace")
  logger("Body: ${body}","debug")

  //verify that this message is for this plugin
  if (headers.'stnp-plugin' != settings.pluginType) {
    return
  }

  //logger("Honeywell Security event: ${evt.stringValue}","trace")
  processEvent(body)
}

private sendCommandPlugin(path) {
  sendCommand("/plugins/"+settings.pluginType+path)
}

private sendCommand(path) {
  //logger("Honeywell Security send command: ${path}","info")

  if (settings.proxyAddress.length() == 0 ||
    settings.proxyPort.length() == 0) {
    logger("SmartThings Node Proxy configuration not set!","error")
    return
  }

  def host = getProxyAddress()
  def headers = [:]
  headers.put("HOST", host)
  headers.put("Content-Type", "application/json")
  headers.put("stnp-auth", settings.authCode)

  def hubAction = new physicalgraph.device.HubAction(
      method: "GET",
      path: path,
      headers: headers
  )
  sendHubCommand(hubAction)
}

private processEvent(evt) {
  if (evt.type == "discover") {
    addChildDevices(evt.partitions, evt.zones)
  }
  if (evt.type == "zone") {
    updateZoneDevices(evt.zone, evt.state)
  }
  if (evt.type == "partition") {
    updatePartitions(evt.partition, evt.state, evt.alpha)
    if (evt.partition == 1) {
        updateAlarmSystemStatus(evt.state)
    }
  }
}

private addChildDevices(partitions, zones) {
  def oldChildren = getChildDevices()
  logger("Existing children: ${oldChildren}","info")
  
  //***********Changes Made By jrodriguez142514-dev***************
  //changed hostHub.id on line 273 to hostHub
  partitions.each {
    def deviceId = 'honeywell|partition'+it.partition
    if (!getChildDevice(deviceId)) {
      addChildDevice("redloro-smartthings", "Honeywell Partition", deviceId, hostHub, ["name": it.name, label: it.name, completedSetup: true])
      logger("Added partition device: ${deviceId}","info")
    }
    else {
      logger("Partition device already exists: ${deviceId}","info")
    }
  }

  //***********Changes Made By jrodriguez142514-dev***************
  //changed hostHub.id on line 287 to hostHub
  zones.each {
    def deviceId = 'honeywell|zone'+it.zone
    if (!getChildDevice(deviceId)) {
      it.type = it.type.capitalize()
      addChildDevice("redloro-smartthings", "Honeywell Zone "+it.type, deviceId, hostHub, ["name": it.name, label: it.name, completedSetup: true])
      logger("Added zone device: ${deviceId}","info")
    }
    else {
      logger("Zone device already exists: ${deviceId}","info")
    }
  }
  logger("Discovery has finished running","info")
}

private removeChildDevices() {
  getAllChildDevices().each { deleteChildDevice(it.deviceNetworkId) }
}

def discoverChildDevices() {
  sendCommandPlugin('/discover')
}

//***********Changes Made By jrodriguez142514-dev***************
//changed hostHub.id on line 316 to hostHub
private updateZoneDevices(zonenum,zonestatus) {
  //logger("updateZoneDevices: ${zonenum} is ${zonestatus}","debug")
  def zonedevice = getChildDevice("honeywell|zone${zonenum}")
  if (zonedevice) {
    zonedevice.zone("${zonestatus}")
  } else {
  	logger("Unknown zone reported status: Zone ${zonenum}","error")
    if(enableAutoDiscovery) {
      def deviceId = 'honeywell|zone'+zonenum
      addChildDevice("redloro-smartthings", "Honeywell Zone Contact", deviceId, hostHub, ["name": deviceId, label: deviceId, completedSetup: true])
      logger("Added zone device: ${deviceId}","info")
    }
  }
}

//***********Changes Made By jrodriguez142514-dev***************
//changed hostHub.id on line 333 to hostHub
private updatePartitions(partitionnum, partitionstatus, panelalpha) {
  //logger("updatePartitions: ${partitionnum} is ${partitionstatus}","debug")
  def partitionDevice = getChildDevice("honeywell|partition${partitionnum}")
  if (partitionDevice) {
    partitionDevice.partition("${partitionstatus}", "${panelalpha}")
  } else {
  	logger("Unknown partition reported status: Partition ${partitionnum}","error")
    if(enableAutoDiscovery) {
      def deviceId = 'honeywell|partition'+partitionnum
      addChildDevice("redloro-smartthings", "Honeywell Partition", deviceId, hostHub, ["name": deviceId, label: deviceId, completedSetup: true])
      logger("Added partition device: ${deviceId}","info")
    }
  }
}

def alarmHandler(evt) {
  if (!settings.enableSHM) {
    return
  }

  if (state.alarmSystemStatus == evt.value) {
    return
  }
  logger("Updating alarm status to match SHM - from ${state.alarmSystemStatus} to ${evt.value}","debug")
  state.alarmSystemStatus = evt.value
  if (evt.value == "stay") {
    sendCommandPlugin('/armStay')
  }
  if (evt.value == "away") {
    sendCommandPlugin('/armAway')
  }
  if (evt.value == "off") {
    sendCommandPlugin('/disarm')
  }
}

private updateAlarmSystemStatus(partitionstatus) {
  if (!settings.enableSHM || partitionstatus == "arming") {
    return
  }

  def lastAlarmSystemStatus = state.alarmSystemStatus
  if (partitionstatus == "armedstay" || partitionstatus == "armedinstant") {
    state.alarmSystemStatus = "stay"
  }
  if (partitionstatus == "armedaway" || partitionstatus == "armedmax") {
    state.alarmSystemStatus = "away"
  }
  if (partitionstatus == "ready") {
    state.alarmSystemStatus = "off"
  }

  if (lastAlarmSystemStatus != state.alarmSystemStatus) {
    logger("Updating SHM to match alarm status - from ${lastAlarmSystemStatus} to ${state.alarmSystemStatus}","debug")
    sendLocationEvent(name: "alarmSystemStatus", value: state.alarmSystemStatus)
  }
}

private getHttpHeaders(headers) {
  def obj = [:]
  new String(headers.decodeBase64()).split("\r\n").each {param ->
    def nameAndValue = param.split(":")
    obj[nameAndValue[0]] = (nameAndValue.length == 1) ? "" : nameAndValue[1].trim()
  }
  return obj
}

private getHttpBody(body) {
  def obj = null;
  if (body) {
    def slurper = new JsonSlurper()
    obj = slurper.parseText(new String(body.decodeBase64()))
  }
  return obj
}

private getProxyAddress() {
  return settings.proxyAddress + ":" + settings.proxyPort
}

private getNotifyAddress() {
  //return settings.hostHub.localIP + ":" + settings.hostHub.localSrvPortTCP
  return getHubAddress()
}

private String convertIPtoHex(ipAddress) {
  return ipAddress.tokenize( '.' ).collect {  String.format( '%02x', it.toInteger() ) }.join().toUpperCase()
}

private String convertPortToHex(port) {
  return port.toString().format( '%04x', port.toInteger() ).toUpperCase()
}

private logger(msg, level) {

    switch(level) {
        case "error":
            if (state.loggingLevelIDE >= 1) log.error msg
            break

        case "warn":
            if (state.loggingLevelIDE >= 2) log.warn msg
            break

        case "info":
            if (state.loggingLevelIDE >= 3) log.info msg
            break

        case "debug":
            if (state.loggingLevelIDE >= 4) log.debug msg
            break

        case "trace":
            if (state.loggingLevelIDE >= 5) log.trace msg
            break

        default:
            log.debug msg
            break
    }
}
