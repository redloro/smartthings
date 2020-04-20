/**
 *  SmartThings Device Handler: Honeywell Zone Motion
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
  definition (name: "Honeywell Zone Water", namespace: "redloro-smartthings", author: "redloro@gmail.com") {
    capability "Water Sensor"
    capability "Sensor"

    command "zone"
  }

  tiles(scale: 2) {
    multiAttributeTile(name:"zone", type: "generic", width: 6, height: 4){
      tileAttribute ("device.water", key: "PRIMARY_CONTROL") {
        attributeState "dry", label:'Dry', icon:"st.alarm.water.dry", backgroundColor:"#79b821"
        attributeState "wet", label:'Water Detected', icon:"st.alarm.water.wet", backgroundColor:"#ffa81e"
        attributeState "alarm", label:'ALARM', icon:"st.alarm.water.wet", backgroundColor:"#ff0000"
      }
    }

    main "zone"

    details(["zone"])
  }
}

def zone(String state) {
  // need to convert open to wet and closed to dry
  def eventMap = [
    'closed':"dry",
    'open':"wet",
    'alarm':"alarm"
  ]
  def newState = eventMap."${state}"
  
  def descMap = [
    'closed':"No Water Detected",
    'open':"Water Detected",
    'alarm':"Alarm Triggered"
  ]
  def desc = descMap."${state}"

  sendEvent (name: "water", value: "${newstate}", descriptionText: "${desc}")
}
