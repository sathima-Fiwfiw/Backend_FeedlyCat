// simulate_device.js
// ไฟล์นี้จำลองเป็น "เครื่องให้อาหารแมว" ที่รอรับคำสั่ง

require('dotenv').config();
const mqtt = require('mqtt');

console.log('🤖 Device is starting...');

// 1. เชื่อมต่อ MQTT (ใช้ Config เดียวกับ Server)
const client = mqtt.connect(process.env.MQTT_HOST, {
    port: process.env.MQTT_PORT,
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
});

client.on('connect', () => {
    console.log('✅ Device Connected to MQTT Cloud!');
    
    // 2. กดติดตาม (Subscribe) หัวข้อที่จะรับคำสั่ง
    client.subscribe('cat/feeder/command', (err) => {
        if (!err) {
            console.log('👂 Waiting for command on topic: cat/feeder/command');
        }
    });
});

// 3. เมื่อมีข้อความเข้ามา
client.on('message', (topic, message) => {
    // แปลงข้อความจาก Buffer เป็น String
    const msg = message.toString();
    console.log(`----------------------------------------`);
    console.log(`🔔 RECEIVED COMMAND!`);
    console.log(`📍 Topic: ${topic}`);
    console.log(`wk Message: ${msg}`); // ต้องขึ้นคำว่า FEED_NOW
    
    if (msg === 'FEED_NOW') {
        console.log('🍗 (Simulated) Dispensing food... Krukk Krukk...');
    }
    console.log(`----------------------------------------`);
});