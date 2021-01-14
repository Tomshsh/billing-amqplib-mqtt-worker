const { connect } = require('amqplib/callback_api')
const { mqttPublish, createLog, getSessionToken } = require('../functions')
const { main } = global.gConfig.topicParts
const { rmqHost } = global.gConfig

const exchange = process.argv[2]

let amqpConn;

function start() {

    if(!getSessionToken()){return setTimeout(start, 1000)}
    else(console.log(getSessionToken()))

    connect(rmqHost, function (err, conn) {
        if (err) {
            console.error("[AMQP]", err.message);
            return setTimeout(start, 1000);
        }
        conn.on("error", function (err) {
            if (err.message !== "Connection closing") {
                console.error("[AMQP] conn error", exchange, main, err.message);
            }
        });
        conn.once("close", function () {
            console.error("[AMQP] reconnecting", exchange, main);
            return setTimeout(start, 1000);
        });
        amqpConn = conn;
        startWorker();
        createLog(`${exchange} - ${main} amqp worker connected`)
    });

}


function startWorker() {
    amqpConn.createChannel(function (err, ch) {
        if (closeOnErr(err)) return;
        ch.on("error", function (err) {
            console.error("[AMQP] channel error", exchange, main, err.message);
        });

        ch.on("close", function () {
            console.log("[AMQP] channel closed", exchange, main);
        });

        ch.prefetch(10);
        ch.assertExchange(exchange, 'direct', { durable: true })
        ch.assertQueue(main, { durable: true }, function (err, q) {
            if (closeOnErr(err)) return;
            ch.bindQueue(q.queue, exchange, main)
            ch.consume(q.queue, processMsg, { noAck: false });
            console.log("[AMQP] Worker is started", exchange, main);
        });


        function processMsg(msg) {
            work(msg, function (err, ok) {
                if (err) {
                    ch.nack(msg, false, true);
                    console.error('[MQTT] publish', exchange, main, err.message)
                    createLog(`failed to ${main} at ${exchange}, ${err.message}`)
                }
                else {
                    ch.ack(msg);
                }
            });
        }
    });
}

async function work(msg, cb) {
    const parsed = JSON.parse(msg.content.toString())
    console.log("[AMQP] Got msg", parsed);
    mqttPublish(parsed, cb);
    createLog(`${main} for ${parsed.description} is pending`)

}


function closeOnErr(err) {
    if (!err) return false;
    console.error("[AMQP] error", exchange, main, err);
    createLog(`amqp connection closed in worker: ${exchange} - ${main}`)
    amqpConn.close();
    return true;
}

start()