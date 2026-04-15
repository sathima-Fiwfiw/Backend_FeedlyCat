require('dotenv').config();
const mqtt = require('mqtt');

let connectUrl = process.env.MQTT_HOST;
if (connectUrl && !connectUrl.startsWith('mqtt')) {
    connectUrl = `mqtts://${connectUrl}`; 
}

const client = mqtt.connect(connectUrl, {
    port: process.env.MQTT_PORT,
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
});

client.on('connect', () => {
    console.log('✅ MQTT Connected Successfully!');
    client.subscribe('cat/feeder/+/scan'); 
});

// เช็คสถานะออนไลน์
const checkDeviceOnline = (deviceId) => {
    return new Promise((resolve) => {
        if (!client.connected) return resolve(false);

        const checkTopic = `cat/feeder/${deviceId}/command`; 
        const responseTopic = `cat/feeder/${deviceId}/status`; 
        let timeoutHandle;

        const cleanup = () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            client.removeListener('message', messageHandler);
            client.unsubscribe(responseTopic);
        };

        const messageHandler = (topic, message) => {
            if (topic === responseTopic && message.toString() === 'ONLINE') {
                cleanup();
                resolve(true); 
            }
        };

        client.subscribe(responseTopic, (err) => {
            if (err) return resolve(false);
            client.on('message', messageHandler);
            client.publish(checkTopic, 'PING');
            timeoutHandle = setTimeout(() => {
                cleanup();
                resolve(false); 
            }, 4000);
        });
    });
};

const sendCommand = (deviceId, command) => {
    if (!client.connected) return false;
    const topic = `cat/feeder/${deviceId}/command`;
    client.publish(topic, command);
    return true;
};

module.exports = { client, sendCommand, checkDeviceOnline };