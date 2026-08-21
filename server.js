const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const cors = require('cors');

//เพิ่มไลบรารีสำหรับจัดการเวลา
const cron = require('node-cron');
const moment = require('moment-timezone');

//เรียกใช้ไฟล์ MQTT โดยดึงมาทั้ง client และ sendCommand
const { client: mqttClient, sendCommand } = require('./config/mqtt');

//เรียกใช้ฐานข้อมูลสำหรับ Query หาเวลา
const db = require('./config/db');

require('./iot/mqttHandler'); // เรียกใช้ Handler ที่เราสร้างไว้เพื่อจัดการข้อมูลจาก Arduino

// Import Route ที่เราสร้างไว้
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
    console.log(`➡️ [${req.method}] ${req.url}`);
    next();
});

// เรียกใช้ Route ทั้งหมด
app.use('/', apiRoutes);

// Route เช็ค Server
app.get('/', (req, res) => {
    res.send('Hello! Server is running...');
});

// ---------------------------------------------------------
// Route พิเศษสำหรับทดสอบสั่งเครื่องให้อาหาร
// ---------------------------------------------------------
app.get('/test-feed', (req, res) => {
    mqttClient.publish('cat/feeder/command', 'FEED_NOW');

    console.log('🐱 Command sent: FEED_NOW');
    res.send('ส่งคำสั่งให้อาหารแมวเรียบร้อยแล้ว! (Check Console)');
});

// ---------------------------------------------------------
// ระบบตั้งเวลาให้อาหารอัตโนมัติ (Scheduler)
// ทำงานทุกๆ 1 นาที (เวลาไทย)
// ---------------------------------------------------------
cron.schedule('* * * * *', () => {

    // 🇹🇭 ใช้เวลาไทย
    const now = moment().tz('Asia/Bangkok');

    const currentTime = now.format('HH:mm');
    const currentDay = now.format('ddd').toUpperCase().substring(0, 2);

    console.log('===================================');
    console.log(`🇹🇭 Thai Time : ${now.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`⏰ Checking schedule : ${currentTime} (${currentDay})`);

    const sql = `
        SELECT *
        FROM schedules
        WHERE time = ?
        AND is_active = 1
    `;

    db.query(sql, [currentTime], (err, results) => {

        if (err) {
            console.error("❌ Scheduler Error:", err);
            return;
        }

        console.log(`📋 Found ${results.length} schedule(s)`);

        if (results.length === 0) {
            console.log("⚠️ No schedule matched this minute.");
        }

        results.forEach(schedule => {

            console.log("📌 Schedule:", schedule);

            const repeat = schedule.repeat || "";

            const isToday =
                repeat === "Everyday" ||
                repeat.includes(currentDay);

            if (isToday) {

                console.log(
                    `🚀 Trigger Feed -> Device: ${schedule.device_id}, Portion: ${schedule.portion}g`
                );

                sendCommand(schedule.device_id, "FEED_NOW");

            } else {

                console.log(
                    `⏭ Skip Device ${schedule.device_id} (Today is ${currentDay}, Repeat = ${repeat})`
                );

            }

        });

    });

}, {
    timezone: "Asia/Bangkok"
});
// ---------------------------------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`🚀 Server running on port ${PORT}`);
    console.log("🇹🇭 Scheduler Timezone : Asia/Bangkok");

    // (Optional)
    // mqttClient.publish('cat/feeder/command', 'SERVER_STARTUP_CHECK');

});