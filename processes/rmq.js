const { connect } = require('amqplib/callback_api')
const Parse = require('parse/node')
const nodeCleanup = require('node-cleanup')

require('../config/config')
if (process.argv[2] == 'charge') require('./mqtt')()

// const { parseUser, parsePass } = global.gconfig.parseServer

// const user = await Parse.User.logIn(parseUser, parsePass)

const arg = process.argv[2]

const exchange = (() => {
    if (arg == 'charge' || arg == 'refund') {
        return 'towel_billing'
    }
})()

let amqpConn;

// async function checkin(msg) {
//     const roomTowelsObj = JSON.parse(msg.content.toString())
//     try {
//         const roomTowels = await new Parse.Object('RoomTowels')
//             .save(roomTowelsObj, { sessionToken: user.getSessionToken() })
//         //do something with roomTowels.. probably publish to mqtt
//         return roomTowels //instead of this return the mqtt messsage, since it depends on the room number
//     }
//     catch (err) {
//         console.error("[Parse] error: couldn't save object")
//         throw err
//     }

// }

// async function checkout(msg) {
//     const roomTowelsId = msg.content.toString()
//     try {
//         const roomTowelsObj = await new Parse.Query('RoomTowels').get(roomTowelsId, { sessionToken: user.getSessionToken() })
//         await roomTowelsObj.destroy({ sessionToken: user.getSessionToken() })
//         return roomTowelsObj //instead of this return the mqtt messsage, since it depends on the room number
//     } catch (err) {
//         console.error("[Parse] error: couldn't delete object")
//         throw err
//     }
// }

function start() {
    connect("amqp://localhost", function (err, conn) {
        if (err) {
            console.error("[AMQP]", err.message);
            return setTimeout(start, 1000);
        }
        conn.on("error", function (err) {
            if (err.message !== "Connection closing") {
                console.error("[AMQP] conn error", err.message);
            }
        });
        conn.once("close", function () {
            console.error("[AMQP] reconnecting");
            return setTimeout(start, 1000);
        });
        console.log("[AMQP] connected");
        amqpConn = conn;
        startWorker();
    });
}


function startWorker() {
    amqpConn.createChannel(function (err, ch) {
        if (closeOnErr(err)) return;
        ch.on("error", function (err) {
            console.error("[AMQP] channel error", err.message);
        });

        ch.on("close", function () {
            console.log("[AMQP] channel closed");
        });

        ch.prefetch(10);

        ch.assertExchange(exchange, 'direct', { durable: true })
        ch.assertQueue(arg, { durable: true }, function (err, q) {
            if (closeOnErr(err)) return;
            ch.bindQueue(q.queue, exchange, arg)
            ch.consume(q.queue, processMsg, { noAck: false });
            console.log("Worker is started");
        });

        function processMsg(msg) {
            work(msg, function (err, ok) {
                if (err) {
                    console.error('[MQTT] publish', err.message)
                    ch.nack(msg, false, true);
                }
                else ch.ack(msg);
            });
        }
    });
}

async function work(msg, cb) {
    const mqttMsg = JSON.parse(msg.content.toString())
    console.log("Got msg ", mqttMsg);

    if (arg == "charge") {
        onMqttMessage((topic, msg, packet) => {
            msg.toString().split('|')
        })

        mqttPublish(mqttMsg, cb);
    }
}


function closeOnErr(err) {
    if (!err) return false;
    console.error("[AMQP] error", err);
    amqpConn.close();
    return true;
}

start()