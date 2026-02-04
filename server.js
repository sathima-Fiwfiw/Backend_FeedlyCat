//ตอนนี้ไฟล์หลักของเราจะเหลือแค่การตั้งค่า Server และเรียกใช้ Route เท่านั้นครับ

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import Route ที่เราสร้างไว้
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json());
app.use(cors());

// เรียกใช้ Route ทั้งหมด โดยนำหน้าด้วย /api
// ผลลัพธ์จะเป็น: /api/cats, /api/register, ฯลฯ
app.use('/api', apiRoutes);

// Route เช็ค Server (Optional)
app.get('/', (req, res) => {
    res.send('Hello! Server is running...');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});