//ไฟล์แจ้งเตือนต่างๆ เช่น แจ้งเตือนเมื่ออาหารหมด หรือแจ้งเตือนเมื่อมีการตั้งเวลาให้อาหารแมว

const db = require('../config/db');

// เพิ่มการแจ้งเตือน
exports.addNotification = (req, res) => {
    const { cat_id, title, event_date, event_time } = req.body;

    if (!cat_id || !title || !event_date || !event_time) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    const sql = "INSERT INTO notifications (cat_id, title, event_date, event_time) VALUES (?, ?, ?, ?)";
    db.query(sql, [cat_id, title, event_date, event_time], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "บันทึกไม่สำเร็จ" });
        }
        res.json({ message: "บันทึกสำเร็จ" });
    });
};

// ดึงการแจ้งเตือนทั้งหมดของ User (ต้อง Join ตารางแมวเพื่อเช็คว่าเป็นของ User คนไหน)
exports.getNotifications = (req, res) => {
    const { user_id } = req.params;

    // แก้ SQL: ใช้ DATE_FORMAT เพื่อล็อคค่าวันที่ให้เป็น String 'yyyy-mm-dd' เป๊ะๆ ไม่ต้องแปลง Timezone
    const sql = `
        SELECT 
            n.id, 
            n.cat_id, 
            n.title, 
            DATE_FORMAT(n.event_date, '%Y-%m-%d') AS event_date, 
            n.event_time, 
            n.is_read,
            c.name_cat 
        FROM notifications n
        JOIN cats c ON n.cat_id = c.cat_id
        WHERE c.user_id = ?
        ORDER BY n.event_date DESC, n.event_time DESC
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        res.json(results);
    });
};

// ฟังก์ชันกดอ่านแล้ว (เคลียร์ตัวเลข)
// ไฟล์: controllers/notificationController.js

exports.markAsRead = (req, res) => {
    const { user_id } = req.body;

    // เพิ่มเงื่อนไข SQL: อัปเดตเฉพาะอันที่ event_date/time ผ่านมาแล้ว หรือเท่ากับปัจจุบัน
    // (ใช้ UTC_TIMESTAMP() หรือ NOW() ตาม Timezone เครื่อง Server)
    const sql = `
        UPDATE notifications n
        JOIN cats c ON n.cat_id = c.cat_id
        SET n.is_read = 1
        WHERE c.user_id = ? 
        AND n.is_read = 0
        AND (
            n.event_date < DATE_FORMAT(NOW(), '%Y-%m-%d') 
            OR (
                n.event_date = DATE_FORMAT(NOW(), '%Y-%m-%d') 
                AND n.event_time <= DATE_FORMAT(NOW(), '%H:%i')
            )
        )
    `;

    db.query(sql, [user_id], (err, result) => {
        if (err) return res.status(500).json({ message: "Update Error" });
        res.json({ message: "Marked as read", affectedRows: result.affectedRows });
    });
};