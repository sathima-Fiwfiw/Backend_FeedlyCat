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

    // แก้ SQL เป็นแบบ Subquery (ปลอดภัยจาก Error GROUP BY)
    const sql = `
        SELECT 
            devices.*, 
            (SELECT name_cat FROM cats WHERE cats.user_id = devices.user_id LIMIT 1) AS name_cat,
            (SELECT birthday FROM cats WHERE cats.user_id = devices.user_id LIMIT 1) AS birthday
        FROM devices 
        WHERE devices.user_id = ?
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) {
            console.error("Database Error:", err); // ถ้ามี error ให้โชว์ใน Terminal ด้วย
            return res.status(500).json({ message: "Database Error" });
        }
        res.json(results);
    });
};

// ฟังก์ชันแก้ไขข้อมูลอุปกรณ์
exports.updateDevice = (req, res) => {
    const { id, device_id, name } = req.body; // id คือ Primary Key ของตาราง (ไม่ใช่ device_id ที่เราตั้งเอง)

    if (!id || !device_id || !name) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    const sql = "UPDATE devices SET device_id = ?, name = ? WHERE id = ?";
    db.query(sql, [device_id, name, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "แก้ไขอุปกรณ์ไม่สำเร็จ" });
        }
        res.json({ message: "แก้ไขอุปกรณ์สำเร็จ" });
    });
};