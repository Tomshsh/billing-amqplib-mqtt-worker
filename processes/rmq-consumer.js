const { connect } = require('amqplib/callback_api')
const Parse = require('parse/node')
const { defineSessionToken, mqttPublish } = require('../functions')

const arg = process.argv[3]

const exchange = process.argv[2]

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
                console.error("[AMQP] conn error",exchange,arg, err.message);
            }
        });
        conn.once("close", function () {
            console.error("[AMQP] reconnecting", exchange, arg);
            return setTimeout(start, 1000);
        });
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
            console.error("[AMQP] channel error",exchange, arg, err.message);
        });

        ch.on("close", function () {
            console.log("[AMQP] channel closed",exchange, arg);
        });

        ch.prefetch(10);
        ch.assertExchange(exchange, 'direct', { durable: true })
        ch.assertQueue(arg, { durable: true }, function (err, q) {
            if (closeOnErr(err)) return;
            ch.bindQueue(q.queue, exchange, arg)
            ch.consume(q.queue, processMsg, { noAck: false });
            console.log("[AMQP] Worker is started",exchange, arg);
        });

        function processMsg(msg) {
            work(msg, function (err, ok) {
                if (err) {
                    console.error('[MQTT] publish',exchange, arg, err.message)
                    ch.nack(msg, false, true);
                }
                else {
                    ch.ack(msg);
                    try {
                        const parsed = JSON.parse(msg.content.toString())
                        createTransaction('pending', parsed.amount, parsed.desc, (Number(parsed.time)+100000).toString())
                    }
                    catch (err) { console.error('[PARSE] error:',exchange, arg, err.message) }
                }
            });
        }
    });
}

async function createTransaction(status, amount, description, serial) {
    const acl = new Parse.ACL()
    acl.setRoleWriteAccess("operator", true)
    acl.setRoleReadAccess("operator", true)
    await new Parse.Object('Transaction')
        .setACL(acl)
        .save({
            status, amount, description, serial, action: arg
        }, { sessionToken })
}

async function work(msg, cb) {
    const mqttMsg = JSON.parse(msg.content.toString())
    console.log("[AMQP] Got msg", mqttMsg);

    if (arg == "charge") {
        // can be moved to a cloud code trigger
        mqttPublish(mqttMsg, cb);
    }
}


function closeOnErr(err) {
    if (!err) return false;
    console.error("[AMQP] error",exchange, arg, err);
    amqpConn.close();
    return true;
}

start()