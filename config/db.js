//เราแยกส่วนต่อ Database ออกมา เพื่อให้ไฟล์อื่นเรียกใช้ได้ง่ายๆ ไม่ต้องเขียนซ้ำ

require('dotenv').config();
const mysql = require('mysql2');

// ในไฟล์ db.js
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+07:00', // กำหนด Timezone เป็นเวลาไทย
    dateStrings: true   // บังคับให้คืนค่า Date/DateTime กลับมาเป็น String เลย
});

// เช็คการเชื่อมต่อตอนเริ่มต้น (Optional)
db.getConnection((err, conn) => {
    if (err) {
        console.error('❌ Database Connection Failed:', err.message);
    } else {
        console.log('✅ Database Connected Successfully!');
        conn.release();
    }
});

module.exports = db;