const { connect } = require('amqplib/callback_api')
const Parse = require('parse/node')
const { defineSessionToken, mqttPublish } = require('../functions')

const arg = process.argv[2]

const exchange = (() => {
    if (arg == 'charge' || arg == 'refund') {
        return 'towel_billing'
    }
})()

let amqpConn;
let sessionToken;

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

    defineSessionToken()
        .then(st => { sessionToken = st })
        .catch(err => console.error(err))

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
                else {
                    ch.ack(msg);
                    try {
                        const parsed = JSON.parse(msg.content.toString())
                        createTransaction('pending', parsed.amount, parsed.desc, parsed.time)
                    }
                    catch (err) { console.error('[PARSE] error:', err.message) }
                }
            });
        }
    });
}

async function createTransaction(status, amount, description, time) {
    const acl = new Parse.ACL()
    acl.setRoleWriteAccess("operator", true)
    acl.setRoleReadAccess("operator", true)
    await new Parse.Object('Transaction')
        .setACL(acl)
        .save({
            status, amount, description, time
        }, { sessionToken })
}

async function work(msg, cb) {
    const mqttMsg = JSON.parse(msg.content.toString())
    console.log("[AMQP] Got msg", mqttMsg);

    if (arg == "charge") {
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