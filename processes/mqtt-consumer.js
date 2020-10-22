const Parse = require('parse/node');
const { mqttClient } = require('../mqtt-client');
const { defineSessionToken } = require('../functions');

const { main, gate, gateTransponder } = global.gConfig.topicParts;
const { checkin, checkout, charge, ok } = global.gConfig.messageParts;
let sessionToken;

function start() {

    defineSessionToken()
        .then(st => sessionToken = st)
        .catch(err => console.error(err))

    mqttClient.subscribe(`${main}/${gate}/${gateTransponder}`, {}, (err, ok) => {
        if (err) {
            console.error("[MQTT] subscription", err.message);
        };
    });

    mqttClient.on('message', async (topic, msg, packet) => {
        const parsedMsg = msg.toString().split('|')
        console.log('[MQTT] received', parsedMsg)
        switch (parsedMsg[0]) {
            case checkin: handleCheckin(parsedMsg[1].slice(2))
                break;
            case checkout: handleCheckout(parsedMsg[1].slice(2))
                break;
            case charge: handleCharge(parsedMsg[5].slice(2), parsedMsg.pop())
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

function getPendingTransaction(time) {
    console.log(time)
    return new Parse.Query('Transaction')
        .equalTo('status', 'pending')
        .equalTo('time', time)
        .first({ sessionToken })
}

async function handleCheckin(roomNumber) {
    const room = await getRoom(roomNumber);
    room.set('isOccupied', true);
    room.save(null, { sessionToken })
        .catch((err) => console.error(err.message));
}

async function handleCheckout(roomNumber) {
    const roomTowel = await getRoomTowel(roomNumber);
    const room = await getRoom(roomNumber);
    roomTowel.destroy({ sessionToken });
    room.set('isOccupied', false);
    room.save(null, { sessionToken })
        .catch(err => console.error(err.message))
}

async function handleCharge(time, answer) {
    const transaction = await getPendingTransaction(time);
    answer == ok
        ? transaction.set('status', 'approved')
        : transaction.set('status', 'denied');
    transaction.save(null, { sessionToken })
        .catch(err => console.error(err.message))
}

start()
