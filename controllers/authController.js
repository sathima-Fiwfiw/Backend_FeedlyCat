//(Logic เกี่ยวกับ User)แยกเรื่องคนออกจากเรื่องแมว เพื่อความเป็นระเบียบ

const db = require('../config/db');

// สมัครสมาชิก
exports.register = (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
        return res.status(400).send("กรุณากรอก name, email, password ให้ครบ");
    }

    const sql = "INSERT INTO user (name, email, password, phone) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, email, password, phone], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).send("สมัครสมาชิกไม่สำเร็จ");
        }
        res.json({
            message: "สมัครสมาชิกเรียบร้อย!",
            user_id: result.insertId,
            name: name
        });
    });
};