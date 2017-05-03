/**
 *  SmartThings SmartApp: Amazon Dash Button
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
import groovy.json.JsonSlurper

definition(
  name: "Dash Button",
  namespace: "redloro-smartthings",
  author: "redloro@gmail.com",
  description: "Amazon Dash Button SmartApp",
  category: "My Apps",
  iconUrl: "https://raw.githubusercontent.com/redloro/smartthings/master/images/dash-button.png",
  iconX2Url: "https://raw.githubusercontent.com/redloro/smartthings/master/images/dash-button.png",
  iconX3Url: "https://raw.githubusercontent.com/redloro/smartthings/master/images/dash-button.png",
  singleInstance: true
)

preferences {
  page(name: "pageMain")
  page(name: "buttonSettings")
}

def pageMain() {
  dynamicPage(name: "pageMain", title: "", install: true, uninstall: true) {

    section("SmartThings Hub") {
      input "hostHub", "hub", title: "Select Hub", multiple: false, required: true
    }

    section("SmartThings Node Proxy") {
      input "proxyAddress", "text", title: "Proxy Address", description: "(ie. 192.168.1.10)", required: true
      input "proxyPort", "text", title: "Proxy Port", description: "(ie. 8080)", required: true, defaultValue: "8080"
      input "authCode", "password", title: "Auth Code", description: "", required: true, defaultValue: "secret-key"
    }

    section( "Notifications" ) {
      input("recipients", "contact", title: "Send notifications to", required: false) {
        input "sendPushMessage", "enum", title: "Send a push notification?", options: ["Yes", "No"], required: false
        input "phone", "phone", title: "Send a Text Message?", required: false
      }
    }

    if (state.buttonCount && !(this."buttonMAC${state.buttonCount-1}")) {
      log.debug "Delete misconfigured button"
      state.buttonCount = state.buttonCount - 1
    }

	state.buttonCount = (!state.buttonCount) ? 0 : state.buttonCount;
    //log.debug "Button count: ${state.buttonCount}"

    section(title:"Buttons") {
      for (def i = 0; i < state.buttonCount; i++) {
        href "buttonSettings", title: this."buttonMAC${i}", description: "Controls "+this."buttonSwitch${i}", required: false, page: "buttonSettings", params: [num: i]
      }
      href "buttonSettings", title: "Add New Button", description: "Tap here to add a new button", image: "http://cdn.device-icons.smartthings.com/thermostat/thermostat-up-icn.png", required: false, page: "buttonSettings", params: [num: state.buttonCount, new: true]
    }
  }
}

def buttonSettings(params) {
  params.num = (int)params.num;
  
  if (params.new) {
    //log.debug "Adding button ${params.num}"
    state.buttonCount = params.num + 1;
  }

  dynamicPage(name: "buttonSettings", title: "Button Settings", install: false, uninstall: false) {
    section() {
      input "buttonMAC${params.num}", "text", title: "Button MAC Address", description: "(ie. aa:bb:cc:dd:ee:f1)", required: false
      input "buttonSwitch${params.num}", "capability.switch", title: "Control Switch", required: false, multiple: true
    }
  }

}

def installed() {
  subscribeToEvents()
}

def subscribeToEvents() {
  subscribe(location, null, lanResponseHandler, [filterEvents:false])
}

def uninstalled() {
}

def updated() {
  updateButtons()
}

def updateButtons() {
  def buttons = [:]
  for (def i = 0; i < state.buttonCount; i++) {
    if (this."buttonMAC${i}" && this."buttonSwitch${i}") {
      buttons.put(this."buttonMAC${i}", "${i}")
    }
  }

  state.buttons = buttons
  log.debug "Dash Buttons set: ${buttons}"

  // subscribe to callback/notifications from STNP
  sendCommand('/subscribe/'+getNotifyAddress())

  // run discover
  sendCommand('/plugins/dash/discover/30')
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
  //log.trace "SmartThings Node Proxy: ${evt.stringValue}"
  //log.trace "Headers: ${headers}"
  //log.trace "Body: ${body}"

  //verify that this message is for this plugin
  if (headers.'stnp-plugin' != 'dash') {
    return
  }

  //log.trace "Dash Button event: ${evt.stringValue}"
  processEvent(body)
}

private sendCommand(path) {
  //log.trace "Dash Button send command: ${path}"

  if (settings.proxyAddress.length() == 0 ||
    settings.proxyPort.length() == 0) {
    log.error "SmartThings Node Proxy configuration not set!"
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
  if (evt.status == "active") {
    updateDevice(evt)
  }
}

private updateDevice(evt) {
  //log.debug "updateDevice: ${evt}"
  send("A button [${evt.address}] has been pressed")

  def devices = getDevices(evt.address)
  def deviceOn = false
  for (device in devices) {
    if (device.currentSwitch == "on") {
      deviceOn = true
    }
  }

  //log.debug "device state: ${device.currentValue('switch')}"
  if (deviceOn) {
    devices.off()
  } else {
    devices.on()
  }
}

private getDevices(address) {
  return this."buttonSwitch${state.buttons[address]}"
}

private send(msg) {
	if (location.contactBookEnabled) {
    log.debug("sending notifications to: ${recipients?.size()}")
    sendNotificationToContacts(msg, recipients)
	}
	else  {
		if (sendPushMessage != "No") {
			log.debug("sending push message")
			sendPush(msg)
		}

		if (phone) {
			log.debug("sending text message")
			sendSms(phone, msg)
		}
	}
	log.debug msg
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
  return settings.hostHub.localIP + ":" + settings.hostHub.localSrvPortTCP
}

private String convertIPtoHex(ipAddress) {
  if (!ipAddress) return;
  String hex = ipAddress.tokenize( '.' ).collect {  String.format( '%02x', it.toInteger() ) }.join().toUpperCase()
  return hex
}

private String convertPortToHex(port) {
  String hexport = port.toString().format( '%04x', port.toInteger() ).toUpperCase()
  return hexport
}
