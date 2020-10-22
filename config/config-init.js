const fs = require('fs')
const buffer = fs.readFileSync('config/config2.json')
global.gConfig = JSON.parse(buffer.toString())