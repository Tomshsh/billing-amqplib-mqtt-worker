const _ = require('lodash');
const fs = require('fs')
const config = require('./config.json');
const Parse = require('parse/node')

const defaultConfig = config.development;
const environment = process.env.NODE_ENV || 'development';
const environmentConfig = config[environment];

const finalConfig = _.merge(defaultConfig, environmentConfig);
fs.writeFileSync('config/config2.json', JSON.stringify(finalConfig))

const { appId, serverURL, userName, password } = finalConfig.parseServer

Parse.initialize(appId)
Parse.serverURL = serverURL

Parse.User.logIn(userName, password)
    .then((user) => {
        fs.writeFileSync('config/sessionToken.json', user.getSessionToken())
    })
    .catch(err => {
        console.error('[PARSE]', err.message)
        fs.writeFileSync('config/sessionToken.json',"error")
    })