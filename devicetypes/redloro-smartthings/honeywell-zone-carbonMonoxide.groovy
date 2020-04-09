/**
 *  SmartThings Device Handler: Honeywell Zone CarbonMonoxide
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
  definition (name: "Honeywell Zone CarbonMonoxide", namespace: "redloro-smartthings", author: "redloro@gmail.com") {
    capability "Carbon Monoxide Detector"
    // Only including Smoke Detector capability so that Smart Home Monitor recognizes it. SHM will not see a CO detector.
    capability "Smoke Detector"
    capability "Sensor"

    command "zone"
  }

  tiles(scale: 2) {
    multiAttributeTile(name:"zone", type: "generic", width: 6, height: 4){
      tileAttribute ("device.carbonMonoxide", key: "PRIMARY_CONTROL") {
        attributeState "clear", label:"CLEAR", icon:"st.alarm.carbon-monoxide.clear", backgroundColor:"#ffffff"
        attributeState "detected", label:"CO DETECTED", icon:"st.alarm.carbon-monoxide.carbon-monoxide", backgroundColor:"#ff0000"
        attributeState "tested", label:"TEST", icon:"st.alarm.carbon-monoxide.test", backgroundColor:"#ffa81e"
      }
    }

    main "zone"

    details(["zone"])
  }
}

def zone(String state) {
  // need to convert open to detected and closed to clear
  def eventMap = [
    'closed':"clear",
    'open':"detected",
    'alarm':"detected",
    'tested':"tested"
  ]
  def newState = eventMap."${state}"

  def descMap = [
    'closed':"Was Cleared",
    'open':"Was Detected",
    'alarm':"Was Detected",
    'tested':"Was Tested"
  ]
  def desc = descMap."${state}"

  sendEvent (name: "carbonMonoxide", value: "${newState}", descriptionText: "${desc}")
}
