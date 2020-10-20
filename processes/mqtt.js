const mqtt = require('mqtt')

const { host, port, username, password, ca } = global.gConfig.mqttClientOptions
const { main, gate, gateTransponder, gateReceiver } = global.gConfig.topicParts
const { base, roomNumber, currTime, count, desc, ta } = global.gConfig.messageParts

const pubTopic = `${main}/${gate}/${gateReceiver}`

const mqttClient = mqtt.connect(host, {
    ca,
    port,
    username,
    password
})

module.exports = function () {

    mqttClient.subscribe(`${main}/${gate}/${gateTransponder}`, {}, (err, ok) => {
        if (err) {
            console.error("[MQTT] subscription", err.message)
        }
    })

    this.mqttPublish = (msg, cb) => {
        const today = new Date()
        const time = today.getHours() + today.getMinutes() + today.getSeconds()
        const finalMsg = `${base}|${roomNumber}${msg.roomNumber}|${count}0|${ta}|${currTime}${time}|${desc}${msg.desc}`
        mqttClient.publish(pubTopic, finalMsg, {}, cb)
    }

    this.onMqttMessage = (cb) => {
        mqttClient.once('message', cb)
    }
}
