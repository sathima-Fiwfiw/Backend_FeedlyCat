// controllers/notificationController.js
const db = require('../config/db');

// 1. เพิ่มการแจ้งเตือนลงตาราง notifications โดยตรง
exports.addNotification = (req, res) => {
    // [แก้ไข] เปลี่ยนจาก cat_id เป็น device_id
    const { device_id, title, threshold_gram } = req.body;

    if (!device_id || !title || threshold_gram === undefined) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    const message = `แจ้งเตือนเมื่ออาหารในถาดเหลือน้อยกว่า ${threshold_gram} กรัม`;

    // [แก้ไข] เปลี่ยนชื่อคอลัมน์ใน SQL เป็น device_id
    const sql = "INSERT INTO notifications (device_id, title, message, is_read, created_at) VALUES (?, ?, ?, 0, NOW())";
    
    db.query(sql, [device_id, title, message], (err, result) => {
        if (err) {
            console.error("Insert Error:", err);
            return res.status(500).json({ message: "บันทึกการแจ้งเตือนไม่สำเร็จ" });
        }
        res.json({ message: "บันทึกการแจ้งเตือนเรียบร้อยแล้ว", id: result.insertId });
    });
};

// 2. ดึงประวัติการแจ้งเตือนทั้งหมด
exports.getNotifications = (req, res) => {
    const { user_id } = req.params;

    // [แก้ไข] เปลี่ยนมา JOIN กับตาราง devices และดึงชื่อเครื่อง (name_device) แทนชื่อแมว
    const sql = `
        SELECT 
            n.id, 
            n.device_id, 
            n.title, 
            n.message, 
            DATE_FORMAT(n.created_at, '%Y-%m-%d') AS event_date, 
            DATE_FORMAT(n.created_at, '%H:%i') AS event_time, 
            n.is_read,
            d.name
        FROM notifications n
        JOIN devices d ON n.device_id = d.device_id
        WHERE d.user_id = ?
        ORDER BY n.created_at DESC
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database Error" });
        }
        res.json(results);
    });
};

// 3. ฟังก์ชันกดอ่านแล้ว
exports.markAsRead = (req, res) => {
    const { user_id } = req.body;
    
    // [แก้ไข] เปลี่ยนมา JOIN กับตาราง devices เพื่อเช็ค user_id
    const sql = `
        UPDATE notifications n
        JOIN devices d ON n.device_id = d.device_id
        SET n.is_read = 1
        WHERE d.user_id = ? AND n.is_read = 0
    `;
    
    db.query(sql, [user_id], (err, result) => {
        if (err) return res.status(500).json({ message: "Update Error" });
        res.json({ message: "Marked as read", affectedRows: result.affectedRows });
    });
};