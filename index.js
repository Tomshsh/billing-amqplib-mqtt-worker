const { spawn } = require('child_process')
const refundConsumer = spawn(process.execPath, ['process.js', 'refund'], { stdio: 'inherit' })
const chargeConsumer = spawn(process.execPath, ['process.js', 'charge'], { stdio: 'inherit' })

