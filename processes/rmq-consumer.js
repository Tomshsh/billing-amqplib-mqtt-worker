const { connect } = require('amqplib/callback_api')
const Parse = require('parse/node')
const { defineSessionToken, mqttPublish, createLog } = require('../functions')

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
                console.error("[AMQP] conn error", exchange, arg, err.message);
            }
        });
        conn.once("close", function () {
            console.error("[AMQP] reconnecting", exchange, arg);
            return setTimeout(start, 1000);
        });
        amqpConn = conn;
        startWorker();
        createLog(`${exchange} - ${arg} amqp worker connected`)
    });

    defineSessionToken()
        .then(st => { sessionToken = st })
        .catch(err => console.error(err))

}


function startWorker() {
    amqpConn.createChannel(function (err, ch) {
        if (closeOnErr(err)) return;
        ch.on("error", function (err) {
            console.error("[AMQP] channel error", exchange, arg, err.message);
        });

        ch.on("close", function () {
            console.log("[AMQP] channel closed", exchange, arg);
        });

        ch.prefetch(10);
        ch.assertExchange(exchange, 'direct', { durable: true })
        ch.assertQueue(arg, { durable: true }, function (err, q) {
            if (closeOnErr(err)) return;
            ch.bindQueue(q.queue, exchange, arg)
            ch.consume(q.queue, processMsg, { noAck: false });
            console.log("[AMQP] Worker is started", exchange, arg);
        });


        function processMsg(msg) {
            //todo: transaction.save() => mqtt.publish => err ? update transaction.status = "mqtt error"
            work(msg, function (err, ok) {
                if (err) {
                    console.error('[MQTT] publish', exchange, arg, err.message)
                    ch.nack(msg, false, true);
                    createLog(`failed to ${arg} at ${exchange}, ${err.message}`)
                }
                else {
                    ch.ack(msg);
                }
            });
        }
    });
}

function createTransaction(amount, description, serial) {
    const acl = new Parse.ACL()
    acl.setRoleWriteAccess("operator", true)
    acl.setRoleReadAccess("operator", true)
    return new Parse.Object('Transaction')
        .setACL(acl)
        .save({
            status: 'pending', amount, description, serial, action: arg
        }, { sessionToken })

}

async function work(msg, cb) {
    const mqttMsg = JSON.parse(msg.content.toString())
    console.log("[AMQP] Got msg", mqttMsg);

    const parsed = JSON.parse(msg.content.toString())
    const serial = (Number(parsed.time) + 100000).toString()
    createTransaction(parsed.amount, parsed.desc, serial)
        .then(transaction => {
            mqttPublish(mqttMsg, cb);
            createLog(`${arg} for ${parsed.desc} is pending`)

        })
        .catch(err => {
            cb(err)
            createLog(`failed creating transaction: ${arg} for ${parsed.desc}, ${err.message}`)
            console.error('[PARSE] error:', exchange, arg, err.message)
        })
}


function closeOnErr(err) {
    if (!err) return false;
    console.error("[AMQP] error", exchange, arg, err);
    createLog(`amqp connection closed in worker: ${exchange} - ${arg}`)
    amqpConn.close();
    return true;
}

start()