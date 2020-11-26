const Parse = require('parse/node');
const { mqttClient } = require('../mqtt-client');
const { defineSessionToken, createLog } = require('../functions');

const { main, gate, gateTransponder } = global.gConfig.topicParts;
const { checkin, checkout, charge, ok } = global.gConfig.messageParts;
let sessionToken;

async function start() {

    try { sessionToken = await defineSessionToken() }
    catch (err) { console.error(err) }

    mqttClient.subscribe(`${main}/${gate}/${gateTransponder}`, { qos: 1 }, (err, ok) => {
        if (err) {
            console.error("[MQTT] subscription", err.message);
        };
    });

    mqttClient.on('message', async (topic, msg, packet) => {
        const parsedMsg = msg.toString().substr(1).split('|')
        parsedMsg.pop()

        if (!parsedMsg[0].length) {
            parsedMsg.shift()
        }

        console.log(topic, '[MQTT] received', parsedMsg)
        switch (parsedMsg[0]) {
            // missing filtering by hotel
            case checkin: handleCheckin(Number(parsedMsg[1].slice(2)))
                break;
            case checkout: handleCheckout(Number(parsedMsg[1].slice(2)))
                break;
            case charge: handleCharge(parsedMsg[3].slice(2), parsedMsg.pop())
                break;
        }
    })
}

function getRoom(roomNumber) {
    return new Parse.Query('Room')
        .equalTo('num', roomNumber)
        .first({ sessionToken })
}

function getRoomTowel(roomNumber) {
    console.log(roomNumber)
    const innerQuery = new Parse.Query('Room')
        .equalTo('num', roomNumber)

    return new Parse.Query('RoomTowels')
        .matchesQuery('room', innerQuery)
        .first({ sessionToken })
}

function getPendingTransaction(serial) {
    return new Parse.Query('Transaction')
        .equalTo('status', 'pending')
        .equalTo('serial', serial)
        .include('refund')
        .first({ sessionToken })
}

function handleCheckin(roomNumber) {
    getRoom(roomNumber)
        .then(room => {
            room.set('isOccupied', true);
            room.set('lastCheckIn', new Date())
            return room.save(null, { sessionToken })
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
            return room.save(null, { sessionToken })
        })
        .then(() => { createLog(`room ${roomNumber} was checked out of`) })
        .catch((err) => {
            console.error(err.message)
            createLog(`failed checking out of room ${roomNumber}, ${err.message}`)
        });
    getRoomTowel(roomNumber)
        .then(roomTowel => {
            if (roomTowel) { return roomTowel.destroy({ sessionToken }); }
        }).catch((err) => { console.error(err) })
}

function setStatusRefunded(refund) {
    console.log(refund)
    refund.set('status', 'refunded')
    return refund.save(null, { sessionToken })
}

async function handleCharge(serial, answer) {
    const transaction = await getPendingTransaction(serial);
    if (answer == ok) {
        transaction.set('status', 'ok')
        if (transaction.get('refund')) {
            try { await setStatusRefunded(transaction.get('refund')) }
            catch { err => { } }
        }
    }
    else {
        transaction.set('status', 'denied');
    }

    transaction.save(null, { sessionToken })
        .then((tr) => { createLog(`transaction ${transaction.get('serial')} ${transaction.get('status')}: ${transaction.get('action')} ${transaction.get('amount')} for ${transaction.get('description')}`) })
        .catch(err => { createLog(`transaction ${transaction.get('serial')} ${transaction.get('status')}, but the corresponding parse object couldn't be updated`) })
}

start()
