const { spawn } = require('child_process')
const refundConsumer = spawn(process.execPath, ['./processes/rmq.js', 'refund'], { stdio: 'inherit' })
const chargeConsumer = spawn(process.execPath, ['./processes/mqtt.js'], { stdio: 'inherit' })

