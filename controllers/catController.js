const db = require('../config/db');

// เพิ่มข้อมูลแมว
exports.addCat = (req, res) => {
    const { user_id, name_cat, birthday } = req.body;

    if (!user_id || !name_cat) {
        return res.status(400).json({ message: "ข้อมูลแมวไม่ครบถ้วน" });
    }

    // เพิ่มลงตาราง cats
    const sql = "INSERT INTO cats (user_id, name_cat, birthday) VALUES (?, ?, ?)";
    db.query(sql, [user_id, name_cat, birthday], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "เพิ่มข้อมูลแมวไม่สำเร็จ" });
        }
        res.json({ message: "เพิ่มข้อมูลแมวสำเร็จ" });
    });
};