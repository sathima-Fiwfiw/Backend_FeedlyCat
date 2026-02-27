// server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. เรียกใช้ไฟล์ MQTT ที่เราเพิ่งสร้าง
const mqttClient = require('./config/mqtt');

// Import Route ที่เราสร้างไว้
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json());
app.use(cors());

// เรียกใช้ Route ทั้งหมด
app.use('/api', apiRoutes);

// Route เช็ค Server
app.get('/', (req, res) => {
    res.send('Hello! Server is running...');
});

// ---------------------------------------------------------
// ✅ เพิ่ม: Route พิเศษสำหรับทดสอบสั่งเครื่องให้อาหาร (กดผ่านเว็บได้เลย)
// ลองเข้าผ่าน Browser: http://localhost:3000/test-feed
// ---------------------------------------------------------
app.get('/test-feed', (req, res) => {
    // ส่งคำสั่งไปที่เครื่องให้อาหาร
    mqttClient.publish('cat/feeder/command', 'FEED_NOW');
    
    console.log('🐱 Command sent: FEED_NOW');
    res.send('ส่งคำสั่งให้อาหารแมวเรียบร้อยแล้ว! (Check Console)');
});
// ---------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    
    // (Optional) ถ้าอยากให้ส่งทันทีที่เปิด Server ให้เอา Comment ออก:
    // mqttClient.publish('cat/feeder/command', 'SERVER_STARTUP_CHECK');
});