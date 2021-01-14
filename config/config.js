const EventEmitter = require('events');
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

class LoginEvent extends EventEmitter { }

const loginEvent = new LoginEvent()

const login = () => Parse.User.logIn(userName, password)
    .then((user) => {
        loginEvent.emit('login', { sessionToken: user.getSessionToken(), userPointer: user.toPointer() })
    })
    .catch(err => {
        console.error('[PARSE] login', err.message)
    })

login()


setInterval(login, 3600 * 5)

module.exports = { loginEvent }