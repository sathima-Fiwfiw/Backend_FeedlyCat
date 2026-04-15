require('dotenv').config();
const express = require('express');
const cors = require('cors');

// ✅ เพิ่มไลบรารีสำหรับจัดการเวลา
const cron = require('node-cron');
const moment = require('moment');

// ✅ เรียกใช้ไฟล์ MQTT โดยดึงมาทั้ง client และ sendCommand
const { client: mqttClient, sendCommand } = require('./config/mqtt');
// ✅ เรียกใช้ฐานข้อมูลสำหรับ Query หาเวลา
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
app.use('/api', apiRoutes);

// Route เช็ค Server
app.get('/', (req, res) => {
    res.send('Hello! Server is running...');
});

// ---------------------------------------------------------
// Route พิเศษสำหรับทดสอบสั่งเครื่องให้อาหาร (กดผ่านเว็บได้เลย)
// ---------------------------------------------------------
app.get('/test-feed', (req, res) => {
    mqttClient.publish('cat/feeder/command', 'FEED_NOW'); 
    
    console.log('🐱 Command sent: FEED_NOW');
    res.send('ส่งคำสั่งให้อาหารแมวเรียบร้อยแล้ว! (Check Console)');
});

// ---------------------------------------------------------
// ✅ ระบบตั้งเวลาให้อาหารอัตโนมัติ (Scheduler)
// ทำงานทุกๆ 1 นาที
// ---------------------------------------------------------
cron.schedule('* * * * *', () => {
    const now = moment();
    const currentTime = now.format('HH:mm'); // ดึงเวลาปัจจุบัน เช่น 14:30
    const currentDay = now.format('ddd').toUpperCase().substring(0, 2); // ดึงชื่อวันสั้นๆ เช่น MO, TU

    console.log(`⏰ Checking schedule for: ${currentTime} (${currentDay})`);

    // ค้นหา Schedule ที่ตรงกับเวลาปัจจุบัน และเปิดใช้งานอยู่ (is_active = 1)
    const sql = "SELECT * FROM schedules WHERE `time` = ? AND is_active = 1";
    
    db.query(sql, [currentTime], (err, results) => {
        if (err) return console.error("❌ Scheduler Error:", err);

        results.forEach(schedule => {
            const repeat = schedule.repeat; // เช่น "Everyday" หรือ "MO,WE,FR"
            
            // ตรวจสอบเงื่อนไขวัน
            const isToday = repeat === 'Everyday' || repeat.includes(currentDay);

            if (isToday) {
                console.log(`🚀 Triggering Feed: Device ${schedule.device_id}, Portion ${schedule.portion}g`);
                
                // ส่งคำสั่งไปที่ MQTT ให้เครื่องจ่ายอาหาร
                sendCommand(schedule.device_id, "FEED_NOW"); 
            }
        });
    });
});
// ---------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    // (Optional) ถ้าอยากให้ส่งทันทีที่เปิด Server ให้เอา Comment ออก:
    // mqttClient.publish('cat/feeder/command', 'SERVER_STARTUP_CHECK');
});