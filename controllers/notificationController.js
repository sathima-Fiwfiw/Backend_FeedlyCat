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

    const sql = `
        SELECT n.*, c.name_cat 
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