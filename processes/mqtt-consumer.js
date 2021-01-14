const Parse = require('parse/node');
const { mqttClient } = require('../mqtt-client');
const { createLog, getSessionToken } = require('../functions');

const { main, gate, gateTransponder } = global.gConfig.topicParts;
const { checkin, checkout, charge, ok, roomNumber, count } = global.gConfig.messageParts;

async function start() {

    if (!getSessionToken()) { return setTimeout(start, 1000) }
    else (console.log(getSessionToken()))

    mqttClient.subscribe(`${main}/${gate}/${gateTransponder}`, { qos: 1 }, (err, ok) => {
        if (err) {
            console.error("[MQTT] subscription", err.message);
            mqttClient.end();
        };
    });

    mqttClient.on('message', async (topic, msg, packet) => {
        const message = msg.toString()
        console.log(topic, '[MQTT] received', message)
        const roomNo = extractParam(roomNumber, message)
        if (extractParam(checkin, message)) {
            handleCheckin(Number(roomNo))
        }

        else if (extractParam(checkout, message)) {
            console.log('checkout')
            handleCheckout(Number(roomNo))
        }

        else if (extractParam(charge, message)) {
            const serial = extractParam(count, message)
            const answer = extractParam(ok, message)
            handleCharge(serial, answer)
        }
    })

}

function extractParam(param, message) {
    if (typeof param == 'string' && typeof message == 'string') {
        const regex = new RegExp(param + '([^|]*)');
        const match = message.match(regex)
        const result = match ? match[1] ? match[1] : match[0] : null
        return result
    }
}

function getRoom(roomNumber) {
    return new Parse.Query('Room')
        .equalTo('num', roomNumber)
        .first({ sessionToken: getSessionToken() })
}

function getRoomTowel(roomNumber) {
    console.log(roomNumber)
    const innerQuery = new Parse.Query('Room')
        .equalTo('num', roomNumber)

    return new Parse.Query('RoomTowels')
        .matchesQuery('room', innerQuery)
        .first({ sessionToken: getSessionToken() })
}

function getPendingTransaction(serial) {
    return new Parse.Query('Transaction')
        .equalTo('status', 'pending')
        .equalTo('serial', serial.toString())
        .include('refund')
        .first({ sessionToken: getSessionToken() })
}

function handleCheckin(roomNumber) {
    getRoom(roomNumber)
        .then(room => {
            room.set('lastCheckIn', new Date())
            room.set('isOccupied', true);
            return room.save(null, { sessionToken: getSessionToken() })
        })
        .then(() => { createLog(`room ${roomNumber} was checked into`) })
        .catch((err) => {
            console.error(err.message)
            createLog(`failed checking into room ${roomNumber}, ${err.message}`)
        });
}

async function handleCheckout(roomNumber) {
    getRoom(roomNumber)
        .then(room => {
            room.set('isOccupied', false);
            room.set('lastCheckOut', new Date())
            return room.save(null, { sessionToken: getSessionToken() })
        })
        .then(() => { createLog(`room ${roomNumber} was checked out of`) })
        .catch((err) => {
            console.error(err.message)
            createLog(`failed checking out of room ${roomNumber}, ${err.message}`)
        });
    getRoomTowel(roomNumber)
        .then(roomTowel => {
            if (roomTowel) { return roomTowel.destroy({ sessionToken: getSessionToken() }); }
        }).catch((err) => { console.error(err) })
}

function setStatusRefunded(refund) {
    refund.set('status', 'refunded')
    return refund.save(null, { sessionToken: getSessionToken() })
}

async function handleCharge(serial, answer) {
    const transaction = await getPendingTransaction(serial);
    if (transaction) {
        if (answer) {
            transaction.set('status', 'ok')
            if (transaction.get('refund')) {
                try { await setStatusRefunded(transaction.get('refund')) }
                catch { err => { } }
            }
        }
        else {
            transaction.set('status', 'denied');
        }

        transaction.save(null, { sessionToken: getSessionToken() })
            .then((tr) => { createLog(`transaction ${transaction.get('serial')} ${transaction.get('status')}: ${transaction.get('action')} ${transaction.get('amount')} for ${transaction.get('description')}`) })
            .catch(err => { createLog(`transaction ${transaction.get('serial')} ${transaction.get('status')}, but the corresponding parse object couldn't be updated`) })
            
    } else { console.error("[PARSE] couldn't find a pending transaction with that serial number") }
}

start()
