const _ = require('lodash');
const fs = require('fs')
const config = require('./config.json');
const caFile = fs.readFileSync('config/3pi-solutions-CA.crt')

config.development.mqttClientOptions.ca = caFile
const defaultConfig = config.development;
const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];

const finalConfig = _.merge(defaultConfig, environmentConfig, caFile);

global.gConfig = finalConfig;

