const { spawn, fork } = require('child_process')
const fs = require('fs')
const cleanup = require('node-cleanup')
const { exitCode } = require('process')
const { loginEvent } = require('./config/config')

loginEvent.on('login', (message) => {
    towelChargeConsumer.send(message)
    minibarChargeConsumer.send(message)
    mqttConsumer.send(message)
})

const towelChargeConsumer = fork('./processes/rmq-consumer.js', ['locker_billing'])
const minibarChargeConsumer = fork('./processes/rmq-consumer.js', ['minibar_billing'])
const mqttConsumer = fork('./processes/mqtt-consumer.js')




cleanup((exitCode, signal) => {
    fs.writeFileSync('config/config2.json', "")
    fs.writeFileSync('config/sessionToken.json', "")
    fs.writeFileSync('config/userPointer.json', "")
})