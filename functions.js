const { mqttClient } = require('./mqtt-client')
const fs = require('fs')
const Parse = require('parse/node')

const { ps, da, ptc, roomNumber, currTime, count, desc, ta } = global.gConfig.messageParts
const { main, gate, gateReceiver } = global.gConfig.topicParts
const { appId, serverURL, role } = global.gConfig.parseServer

Parse.initialize(appId)
Parse.serverURL = serverURL
let userPointer;

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

const defineUserPointer = () => new Promise(
    function defineUserPointer(resolve, reject) {
        const pointer = fs.readFileSync('config/userPointer.json').toString()

        if (!pointer) setTimeout(() => defineUserPointer(resolve, reject), 500)

        if (pointer == "error") reject("[PARSE] error: unauthorized")

        else if (pointer) {
            userPointer = JSON.parse(pointer)
            resolve(JSON.parse(pointer))
        }
    }
)

exports.mqttPublish = function mqttPublish(msg, cb) {
    const pubTopic = `${main}/${gate}/${gateReceiver}`
    const finalMsg = `${ps}|${da + get8FigDate()}|${ptc}|${roomNumber}${msg.roomNo}|${count}${msg.serial}|${ta + msg.amount}|${currTime}${Number(msg.serial) - 100000}|${desc}${msg.description}`
    console.log('[MQTT] publishing', finalMsg)
    mqttClient.publish(pubTopic, finalMsg, {qos: 1}, cb)
}

function get8FigDate() {
    const d = new Date()
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const date = d.getDate().toString().padStart(2, '0')
    return year + month + date
}

exports.createLog = async function createLog(message) {
    const user = userPointer ? userPointer : await defineUserPointer()
    const acl = new Parse.ACL()
    acl.setRoleWriteAccess(role, true)
    acl.setRoleReadAccess(role, true)
    return new Parse.Object("Log")
        .setACL(acl)
        .save({ message, user })
        .catch(() => { })
}