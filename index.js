const { spawn } = require('child_process')
const fs = require('fs')
const cleanup = require('node-cleanup')
const { exitCode } = require('process')
require('./config/config')

const towelChargeConsumer = spawn(process.execPath, ['./processes/rmq-consumer.js', 'towel_billing', 'charge'], { stdio: 'inherit' })
const towelRefundConsumer = spawn(process.execPath, ['./processes/rmq-consumer.js', 'towel_billing', 'refund'], { stdio: 'inherit' })
const minibarChargeConsumer = spawn(process.execPath, ['./processes/rmq-consumer.js', 'minibar_billing', 'charge'], { stdio: 'inherit' })
const minibarRefundConsumer = spawn(process.execPath, ['./processes/rmq-consumer.js', 'minibar_billing', 'refund'], { stdio: 'inherit' })
const mqttConsumer = spawn(process.execPath, ['./processes/mqtt-consumer.js'], { stdio: 'inherit' })

cleanup((exitCode, signal) => {
    fs.writeFileSync('config/config2.json', "")
    fs.writeFileSync('config/sessionToken.json', "")
})