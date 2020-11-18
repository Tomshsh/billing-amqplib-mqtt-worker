const Parse = require('parse/node');
const { mqttClient } = require('../mqtt-client');
const { defineSessionToken, createLog } = require('../functions');

const { main, gate, gateTransponder } = global.gConfig.topicParts;
const { checkin, checkout, charge, ok } = global.gConfig.messageParts;
let sessionToken;

async function start() {

    try { sessionToken = await defineSessionToken() }
    catch (err) { console.error(err) }

    mqttClient.subscribe(`${main}/${gate}/${gateTransponder}`, {}, (err, ok) => {
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
    const innerQuery = new Parse.Query('Room')
        .equalTo('num', roomNumber)

    return new Parse.Query('RoomTowels')
        .matchesQuery('room', innerQuery)
        .first({ sessionToken })
}

function getPendingTransaction(serial) {
    console.log(serial)
    return new Parse.Query('Transaction')
        .equalTo('status', 'pending')
        .equalTo('serial', serial)
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

function handleCheckout(roomNumber) {
    getRoomTowel(roomNumber)
        .then(roomTowel => {
            createLog(`guest ${roomTowel.get('guestName')} has checked out of room ${roomNumber}`)
            return roomTowel.destroy({ sessionToken });
        }).catch((err) => {
            console.error(err)
            createLog(`failed cheking guest ${roomTowel.get('guestName')} out of room ${roomNumber}`)
        })
}

async function handleCharge(serial, answer) {
    const transaction = await getPendingTransaction(serial);
    answer == ok
        ? transaction.set('status', 'approved')
        : transaction.set('status', 'denied');
    transaction.save(null, { sessionToken })
        .then((tr) => { createLog(`transaction ${transaction.get('serial')} ${transaction.get('status')}: charge ${transaction.get('amount')} for ${transaction.get('description')}`) })
        .catch(err => { createLog(`transaction ${transaction.get('serial')} ${transaction.get('status')}, but the corresponding parse object couldn't be updated`) })
}

start()
