const db = require('../config/db');

// เพิ่มข้อมูลแมว (พร้อมรูปภาพ)
exports.addCat = (req, res) => {
    const { user_id, name_cat, birthday } = req.body;
    
    // ดึง URL รูปจาก Cloudinary (ถ้ามี)
    const image = req.file ? req.file.path : null;

    // เช็คค่าที่จำเป็น
    if (!user_id || !name_cat) {
        return res.status(400).json({ message: "ข้อมูลแมวไม่ครบถ้วน (ขาด User ID หรือ ชื่อแมว)" });
    }

    // เพิ่มลงตาราง cats (ต้องมี column 'image' ใน Database)
    const sql = "INSERT INTO cats (user_id, name_cat, birthday, image) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [user_id, name_cat, birthday, image], (err, result) => {
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
    const { user_id, name_cat, birthday } = req.body;
    // (Logic แก้ไขเดิม)
    const sql = "UPDATE cats SET name_cat = ?, birthday = ? WHERE user_id = ?";
    db.query(sql, [name_cat, birthday, user_id], (err, result) => {
        if (err) return res.status(500).json({ message: "Error updating cat" });
        res.json({ message: "Update success" });
    });
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