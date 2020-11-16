const { mqttClient } = require('./mqtt-client')
const fs = require('fs')
const Parse = require('parse/node')

const { ps, da, ptc, roomNumber, currTime, count, desc, ta } = global.gConfig.messageParts
const { main, gate, gateReceiver } = global.gConfig.topicParts
const { appId, serverURL, role } = global.gConfig.parseServer

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
    const date = new Date()
    const pubTopic = `${main}/${gate}/${gateReceiver}`
    const finalMsg = `${ps}|${da + get8FigDate()}|${ptc}|${roomNumber}${msg.roomNo}|${count}${Number(msg.time) + 100000}|${ta + msg.amount}|${currTime}${msg.time}|${desc}${msg.desc}`
    console.log('[MQTT] publishing', finalMsg)
    mqttClient.publish(pubTopic, finalMsg, {}, cb)
}

function get8FigDate() {
    const d = new Date()
    const year = d.getFullYear()
    const month = d.getMonth().toString().padStart(2, '0')
    const date = d.getDate().toString().padStart(2, '0')
    return year + month + date
}

exports.createLog = function createLog(message) {
    const acl = new Parse.ACL()
    acl.setRoleWriteAccess(role, true)
    acl.setRoleReadAccess(role, true)
    return new Parse.Object("Log")
        .setACL(acl)
        .save({ message })
        .catch(() => { })
}