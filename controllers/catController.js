const db = require('../config/db');

// เพิ่มข้อมูลแมว (พร้อมรูปภาพ และเพศ)
exports.addCat = (req, res) => {
    // 1. รับค่า gender เพิ่มเข้ามาจาก req.body
    const { user_id, name_cat, birthday, gender } = req.body;
    
    const image = req.file ? req.file.path : null;

    if (!user_id || !name_cat) {
        return res.status(400).json({ message: "ข้อมูลแมวไม่ครบถ้วน (ขาด User ID หรือ ชื่อแมว)" });
    }

    // 2. เพิ่ม column gender ในคำสั่ง SQL
    const sql = "INSERT INTO cats (user_id, name_cat, birthday, gender, image) VALUES (?, ?, ?, ?, ?)";
    
    // 3. ใส่ตัวแปร gender เข้าไปใน array (ลำดับต้องตรงกับ VALUES)
    db.query(sql, [user_id, name_cat, birthday, gender, image], (err, result) => {
        if (err) {
            console.error("Error adding cat:", err);
            return res.status(500).json({ message: "เพิ่มข้อมูลแมวไม่สำเร็จ" });
        }
        res.json({ 
            message: "เพิ่มข้อมูลแมวสำเร็จ", 
            cat_id: result.insertId,
            image_url: image 
        });
    });
};

// แก้ไขข้อมูลแมว
exports.updateCat = (req, res) => {
    // รับค่า cat_id มาด้วย เพื่อระบุว่าจะแก้ตัวไหน
    const { cat_id, name_cat, birthday, gender } = req.body;
    
    // ตรวจสอบรูปภาพ: ถ้ามีอัปโหลดใหม่ใช้ path ใหม่, ถ้าไม่มีให้เป็น null (เดี๋ยวไปเช็คใน SQL)
    const newImage = req.file ? req.file.path : null;

    if (!cat_id || !name_cat) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน (ขาด ID หรือ ชื่อแมว)" });
    }

    // กรณีมีรูปใหม่มาด้วย ให้Updateรูปด้วย
    if (newImage) {
        const sql = "UPDATE cats SET name_cat = ?, birthday = ?, gender = ?, image = ? WHERE cat_id = ?";
        db.query(sql, [name_cat, birthday, gender, newImage, cat_id], (err, result) => {
            if (err) return res.status(500).json({ message: "Update failed" });
            res.json({ message: "Update success", image_url: newImage });
        });
    } else {
        // กรณีไม่มีรูปใหม่ (ใช้รูปเดิม)
        const sql = "UPDATE cats SET name_cat = ?, birthday = ?, gender = ? WHERE cat_id = ?";
        db.query(sql, [name_cat, birthday, gender, cat_id], (err, result) => {
            if (err) return res.status(500).json({ message: "Update failed" });
            res.json({ message: "Update success" });
        });
    }
};

// ดึงข้อมูลแมว
exports.getCats = (req, res) => {
    const { user_id } = req.params;
    const sql = "SELECT * FROM cats WHERE user_id = ?";
    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        res.json(results);
    });
};

// ลบข้อมูลแมว
exports.deleteCat = (req, res) => {
    const { cat_id } = req.body; // รับ ID ที่จะลบ

    if (!cat_id) {
        return res.status(400).json({ message: "ไม่พบ ID ที่ต้องการลบ" });
    }

    const sql = "DELETE FROM cats WHERE cat_id = ?";
    db.query(sql, [cat_id], (err, result) => {
        if (err) {
            console.error("Error deleting cat:", err);
            return res.status(500).json({ message: "ลบข้อมูลไม่สำเร็จ" });
        }
        res.json({ message: "ลบข้อมูลสำเร็จ" });
    });
};