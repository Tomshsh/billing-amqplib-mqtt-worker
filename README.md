# billing-amqplib-mqtt-worker
**functions.js** initilizes parse once for each process,  
exports `mqttPublish()` -publishes a given message to the /receiver topic <br />
<br />
**index.js** parent process, spawns rmq-consumer with an argument, and mqtt-consumer  
upon ending the process, as a cleanup effect, it deletes the content of config2.json and sessionToken.json <br />
<br />
**mqtt-client/index.js** starts the mqttClient and exports it <br />
<br />
**mqtt-consumer.js**(renamed from 'mqtt') subcribes to the /transponder topic and handles any checkin/checkout/charge messages by performing Parse actions  <br />
<br />
**rmq-consumer.js** creates a queue and binds it to an exchange, a message sent to the "charge" queue would be forwarded to the /receiver topic and acked, the a Transaction parse object is created with its status set to "pending" <br />
<br />
**/config** contains **config.js**, which uses the **fs** npm package to produce temporary config files, <br />
  it's `require`d in **index.js** and cleared upon killing the process.

`$ node index.js`
