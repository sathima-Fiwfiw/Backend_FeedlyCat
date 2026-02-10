const db = require('../config/db');

// 1. เพิ่มการตั้งเวลา (Add Schedule)
exports.addSchedule = (req, res) => {
    // รับค่าจากหน้าบ้าน (Flutter)
    // หมายเหตุ: repeat เป็นคำสงวนในบาง DB เลยใช้ชื่อตัวแปร repeat_day แทนในโค้ดก็ได้
    const { device_id, time, portion, repeat_day } = req.body; 

    if (!device_id || !time) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบ (ต้องมี ID เครื่อง และ เวลา)" });
    }

    // SQL สำหรับบันทึกลงตาราง schedules
    // ใช้ `repeat` (มี backtick) เพราะอาจซ้ำกับคำสั่ง SQL
    const sql = "INSERT INTO schedules (device_id, `time`, portion, `repeat`, is_active) VALUES (?, ?, ?, ?, 1)";
    
    db.query(sql, [device_id, time, portion || 1, repeat_day || 'Everyday'], (err, result) => {
        if (err) {
            console.error("Error adding schedule:", err);
            return res.status(500).json({ message: "บันทึกเวลาไม่สำเร็จ" });
        }
        res.json({ message: "บันทึกเวลาสำเร็จ", id: result.insertId });
    });
};

// 2. ดึงรายการเวลาของเครื่องนั้นๆ (Get Schedules)
exports.getSchedules = (req, res) => {
    const { device_id } = req.params;

    const sql = "SELECT * FROM schedules WHERE device_id = ? ORDER BY `time` ASC";
    
    db.query(sql, [device_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        
        // ส่งข้อมูลกลับไปให้แอป
        res.json(results);
    });
};

// 3. ลบเวลา (Delete Schedule)
exports.deleteSchedule = (req, res) => {
    const { schedule_id } = req.body;

    const sql = "DELETE FROM schedules WHERE schedule_id = ?";
    
    db.query(sql, [schedule_id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "ลบรายการไม่สำเร็จ" });
        }
        res.json({ message: "ลบรายการสำเร็จ" });
    });
};

// 4. เปิด/ปิด การใช้งาน (Toggle Active)
exports.toggleSchedule = (req, res) => {
    const { schedule_id, is_active } = req.body; // รับค่า 1 หรือ 0

    const sql = "UPDATE schedules SET is_active = ? WHERE schedule_id = ?";
    
    db.query(sql, [is_active, schedule_id], (err, result) => {
        if (err) return res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ" });
        res.json({ message: "อัปเดตสถานะสำเร็จ" });
    });
};