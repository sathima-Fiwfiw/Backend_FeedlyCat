//ไฟล์นี้จะเก็บ Function การทำงานต่างๆ เอาไว้ (Logic ล้วนๆ) เก็บแมวทั้งหมด, ดึงประวัติการกิน, สั่งให้อาหาร (Logic เกี่ยวกับแมว)

const db = require('../config/db');

// ดึงรายชื่อแมวทั้งหมด
exports.getAllCats = (req, res) => {
    const sql = 'SELECT * FROM cats';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database Error' });
        }
        res.json(results);
    });
};

// ดึงประวัติการกิน
exports.getFeedingLogs = (req, res) => {
    const sql = 'SELECT * FROM feeding_logs ORDER BY timestamp DESC LIMIT 20';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
};

// สั่งให้อาหาร
exports.feedCat = (req, res) => {
    const { amount } = req.body;
    console.log(`📝 ได้รับคำสั่งให้อาหาร: ${amount} กรัม`);
    
    // (อนาคตใส่ Logic MQTT หรือ Insert Log ตรงนี้)

    res.json({ 
        message: 'รับคำสั่งเรียบร้อย (จำลอง)', 
        amount: amount, 
        status: 'processing' 
    });
};