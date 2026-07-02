// controllers/notificationController.js
const db = require('../config/db');

// 1. ✅ บันทึก "เกณฑ์แจ้งเตือน" ของเครื่อง (ไม่ใช่การสร้างแจ้งเตือนทันที)
//    ระบบจะคอยเทียบน้ำหนักจริงจาก MQTT กับเกณฑ์นี้ใน mqttHandler.js
//    แล้วค่อยสร้างแจ้งเตือนจริงตอนน้ำหนักต่ำกว่าเกณฑ์
exports.addNotification = (req, res) => {
    const { device_id, title, threshold_gram } = req.body;

    if (!device_id || !title || threshold_gram === undefined) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    // upsert: ถ้าเครื่องนี้เคยตั้งค่าไว้แล้ว ให้อัปเดตทับ ถ้ายังไม่เคย ให้สร้างใหม่
    const sql = `
        INSERT INTO device_alert_settings (device_id, title, threshold_gram)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE title = VALUES(title), threshold_gram = VALUES(threshold_gram)
    `;

    db.query(sql, [device_id, title, threshold_gram], (err, result) => {
        if (err) {
            console.error("❌ บันทึกเกณฑ์แจ้งเตือนไม่สำเร็จ:", err);
            return res.status(500).json({ message: "บันทึกการตั้งค่าแจ้งเตือนไม่สำเร็จ" });
        }
        console.log(`⚙️ ตั้งเกณฑ์แจ้งเตือนเครื่อง ${device_id}: "${title}" เมื่อน้อยกว่า ${threshold_gram}g`);
        res.json({ message: "บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว" });
    });
};

// 2. ดึงประวัติการแจ้งเตือนทั้งหมด (การแจ้งเตือนที่เกิดขึ้นจริงเท่านั้น ไม่ใช่ค่าตั้งไว้)
exports.getNotifications = (req, res) => {
    const { user_id } = req.params;

    const sql = `
        SELECT 
            n.id, 
            n.device_id, 
            n.title, 
            n.message, 
            DATE_FORMAT(n.created_at, '%Y-%m-%d') AS event_date, 
            DATE_FORMAT(n.created_at, '%H:%i') AS event_time, 
            n.is_read,
            d.name AS device_name
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

// 4. ✅ ลบการแจ้งเตือนทีละรายการ (ใช้กับ swipe-to-delete ในแอป)
exports.deleteNotification = (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ message: "ต้องระบุ id ของการแจ้งเตือนที่จะลบ" });
    }

    const sql = "DELETE FROM notifications WHERE id = ?";

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("❌ ลบการแจ้งเตือนไม่สำเร็จ:", err);
            return res.status(500).json({ message: "ลบการแจ้งเตือนไม่สำเร็จ" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "ไม่พบการแจ้งเตือนนี้ (อาจถูกลบไปแล้ว)" });
        }
        console.log(`🗑️ ลบการแจ้งเตือน id=${id} เรียบร้อยแล้ว`);
        res.json({ message: "ลบการแจ้งเตือนเรียบร้อยแล้ว" });
    });
};