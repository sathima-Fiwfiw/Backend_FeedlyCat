const db = require('../config/db');

// --- เพิ่มฟังก์ชันใหม่สำหรับ Hardware (RFID Reader) ---
// ส่วนนี้ใช้บันทึกเมื่อแมวมาสแกน Tag แล้วกินอาหาร
exports.recordFeeding = (req, res) => {
    const { rfid_tag, food_amount } = req.body;

    if (!rfid_tag) {
        return res.status(400).json({ message: "ไม่พบรหัส RFID" });
    }

    // ค้นหา cat_id จาก rfid_tag ก่อน เพื่อดูว่าเป็นแมวตัวไหน
    const findCatSql = "SELECT cat_id FROM cats WHERE rfid_tag = ?";
    db.query(findCatSql, [rfid_tag], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ message: "ไม่พบแมวที่ลงทะเบียนด้วย Tag นี้" });
        }

        const cat_id = results[0].cat_id;
        // บันทึกลงตารางการกิน (สมมติว่าชื่อตาราง feeding_history)
        const insertSql = "INSERT INTO feeding_history (cat_id, food_amount, feeding_time) VALUES (?, ?, NOW())";
        db.query(insertSql, [cat_id, food_amount || 0], (err, result) => {
            if (err) return res.status(500).json({ message: "บันทึกการกินไม่สำเร็จ" });
            res.json({ message: "บันทึกข้อมูลการกินเรียบร้อย", cat_id: cat_id });
        });
    });
};

// เพิ่มข้อมูลแมว (ตรวจสอบรหัส RFID ซ้ำก่อนบันทึก)
exports.addCat = (req, res) => {
    const { user_id, name_cat, birthday, gender, rfid_tag, note } = req.body;
    const image = req.file ? req.file.path : null;

    // 1. เช็คค่าที่จำเป็น
    if (!user_id || !name_cat) {
        return res.status(400).json({ message: "ข้อมูลแมวไม่ครบถ้วน" });
    }
    
    if (!rfid_tag || rfid_tag.trim() === "") {
        return res.status(400).json({ message: "กรุณาระบุรหัส RFID ให้ถูกต้องก่อนบันทึก" });
    }

    // 2. ตรวจสอบว่ามี rfid_tag นี้ในฐานข้อมูลแล้วหรือยัง
    const checkSql = "SELECT name_cat FROM cats WHERE rfid_tag = ?";
    db.query(checkSql, [rfid_tag], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล" });
        }

        if (results.length > 0) {
            // ✅ ถ้าเจอข้อมูลซ้ำ ให้ส่ง Error กลับไป และหยุดการทำงานทันที
            const existingCatName = results[0].name_cat;
            return res.status(400).json({ 
                message: `ไม่สามารถเพิ่มได้ เนื่องจากรหัส RFID นี้ถูกใช้งานแล้ว` 
            });
        }

        // 3. ถ้าไม่ซ้ำ ให้ทำการบันทึกข้อมูลตามปกติ
        const insertSql = "INSERT INTO cats (user_id, name_cat, birthday, gender, rfid_tag, note, image) VALUES (?, ?, ?, ?, ?, ?, ?)";
        db.query(insertSql, [user_id, name_cat, birthday, gender, rfid_tag, note, image], (err, result) => {
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
    });
};

// --- แก้ไขข้อมูลแมว (รวมถึงการ Set Tag จากหน้าแอป) ---
exports.updateCat = (req, res) => {
    // รับค่าจากแอปฯ รวมถึง rfid_tag และ note
    const { cat_id, name_cat, birthday, gender, rfid_tag, note } = req.body;
    const newImage = req.file ? req.file.path : null;

    if (!cat_id || !name_cat) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    let sql;
    let params;

    if (newImage) {
        sql = "UPDATE cats SET name_cat = ?, birthday = ?, gender = ?, rfid_tag = ?, note = ?, image = ? WHERE cat_id = ?";
        params = [name_cat, birthday, gender, rfid_tag, note, newImage, cat_id];
    } else {
        sql = "UPDATE cats SET name_cat = ?, birthday = ?, gender = ?, rfid_tag = ?, note = ? WHERE cat_id = ?";
        params = [name_cat, birthday, gender, rfid_tag, note, cat_id];
    }

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "แก้ไขข้อมูลแมวไม่สำเร็จ" });
        }
        res.json({ message: "แก้ไขข้อมูลแมวสำเร็จ", image_url: newImage });
    });
};
// ดึงข้อมูลแมว
// ในไฟล์ catController.js
exports.getCats = (req, res) => {
    const { user_id } = req.params;
    
    // --- [จุดแก้ไข] ใช้ DATE_FORMAT ห่อฟิลด์ birthday ---
    const sql = `
        SELECT 
            cat_id, 
            user_id, 
            name_cat, 
            DATE_FORMAT(birthday, '%Y-%m-%d') as birthday, 
            gender, 
            rfid_tag, 
            note, 
            image 
        FROM cats 
        WHERE user_id = ?
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        res.json(results);
    });
};

// ลบข้อมูลแมว
exports.deleteCat = (req, res) => {
    const { cat_id } = req.body;
    if (!cat_id) return res.status(400).json({ message: "ไม่พบ ID ที่ต้องการลบ" });

    const sql = "DELETE FROM cats WHERE cat_id = ?";
    db.query(sql, [cat_id], (err, result) => {
        if (err) {
            console.error("Error deleting cat:", err);
            return res.status(500).json({ message: "ลบข้อมูลไม่สำเร็จ" });
        }
        res.json({ message: "ลบข้อมูลสำเร็จ" });
    });
};  