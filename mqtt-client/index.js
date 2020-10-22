const mqtt = require('mqtt')
const fs = require('fs')
require('../config/config-init')

const ca = fs.readFileSync('config/3pi-solutions-CA.crt')
const { host, port, username, password } = global.gConfig.mqttClientOptions

exports.mqttClient = mqtt.connect(host, {
    ca,
    port,
    username,
    password
})