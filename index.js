const { spawn } = require('child_process')
const fs = require('fs')
const cleanup = require('node-cleanup')
const { exitCode } = require('process')
require('./config/config')

const chargeConsumer = spawn(process.execPath, ['./processes/rmq-consumer.js', 'charge'], { stdio: 'inherit' })
const mqttConsumer = spawn(process.execPath, ['./processes/mqtt-consumer.js'], { stdio: 'inherit' })

cleanup((exitCode, signal) => {
    fs.writeFileSync('config/config2.json',"")
    fs.writeFileSync('config/sessionToken.json',"")
})