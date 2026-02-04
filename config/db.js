//เราแยกส่วนต่อ Database ออกมา เพื่อให้ไฟล์อื่นเรียกใช้ได้ง่ายๆ ไม่ต้องเขียนซ้ำ

require('dotenv').config();
const mysql = require('mysql2');

// สร้าง Connection Pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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