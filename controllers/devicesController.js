const db = require('../config/db');

// เพิ่มอุปกรณ์ใหม่
exports.addDevice = (req, res) => {
    const { user_id, device_id, name } = req.body;

    if (!user_id || !device_id || !name) {
        return res.status(400).json({ message: "ข้อมูลอุปกรณ์ไม่ครบถ้วน" });
    }

    // เพิ่มลงตาราง devices
    const sql = "INSERT INTO devices (user_id, device_id, name, status) VALUES (?, ?, ?, 'offline')";
    db.query(sql, [user_id, device_id, name], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "เพิ่มอุปกรณ์ไม่สำเร็จ (อาจมี ID นี้ซ้ำในระบบ)" });
        }
        res.json({ message: "เพิ่มอุปกรณ์สำเร็จ", id: result.insertId });
    });
};

// ดึงรายการอุปกรณ์ของผู้ใช้ (เพื่อให้หน้า DevicePage แสดงผลได้)
exports.getDevices = (req, res) => {
    const { user_id } = req.params;

    db.query("SELECT * FROM devices WHERE user_id = ?", [user_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        res.json(results);
    });
};