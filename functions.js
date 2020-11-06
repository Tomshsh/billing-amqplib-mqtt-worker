const { mqttClient } = require('./mqtt-client')
const fs = require('fs')
const Parse = require('parse/node')

const { base, roomNumber, currTime, count, desc, ta } = global.gConfig.messageParts
const { main, gate, gateReceiver } = global.gConfig.topicParts
const { appId, serverURL } = global.gConfig.parseServer

Parse.initialize(appId)
Parse.serverURL = serverURL

exports.defineSessionToken = () => new Promise(
    function defineSessionToken(resolve, reject) {
        const st = (fs.readFileSync('config/sessionToken.json').toString())
        if (!st) setTimeout(() => {
            defineSessionToken(resolve, reject)
        }, 500)
        if (st == "error") {
            reject('[PARSE] error: unauthorized')
        }
        else if (st) {
            resolve(st)
        }
    })

exports.mqttPublish = function mqttPublish(msg, cb) {
    const pubTopic = `${main}/${gate}/${gateReceiver}`
    const finalMsg = `${base}|${roomNumber}${msg.roomNo}|${count}${Number(msg.time) + 100000}|${ta}|${currTime}${msg.time}|${desc}${msg.desc}`
    console.log('[MQTT] publishing', finalMsg)
    mqttClient.publish(pubTopic, finalMsg, {}, cb)
}