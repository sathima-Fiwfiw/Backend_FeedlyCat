const db = require('../config/db');

// Register
exports.register = (req, res) => {
    const { name, email, password, phone } = req.body;
    
    // เปลี่ยนจาก .filename เป็น .path
    // ถ้ามีรูป -> เอาลิงค์จาก Cloudinary (req.file.path)
    // ถ้าไม่มี -> ให้เป็น null
    const img_profile = req.file ? req.file.path : null;

    // --- (ด้านล่างนี้เหมือนเดิม) --- 
    if (!name || !email || !password || !phone) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
    }

    const checkSql = "SELECT * FROM user WHERE email = ? OR phone = ?";
    
    db.query(checkSql, [email, phone], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database Error" });
        }

        if (results.length > 0) {
            const existingUser = results[0];
            if (existingUser.email === email) {
                return res.status(400).json({ message: "Email นี้ถูกใช้งานแล้ว" });
            }
            if (existingUser.phone === phone) {
                return res.status(400).json({ message: "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" });
            }
        }

        // บันทึกลง Database (รวม img_profile)
        const insertSql = "INSERT INTO user (name, email, password, phone, img_profile) VALUES (?, ?, ?, ?, ?)";
        
        db.query(insertSql, [name, email, password, phone, img_profile], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "เกิดข้อผิดพลาดในการสมัครสมาชิก" });
            }
            
            res.json({
                message: "สมัครสมาชิกเรียบร้อย!",
                user_id: result.insertId,
                name: name,
                img_profile: img_profile // ส่งลิงค์รูปกลับไปให้ดูเล่นๆ ด้วย
            });
        });
    });
};

// ... ส่วน Login (ใช้ของเดิมได้เลยครับ หรือจะเพิ่มให้ส่ง img_profile กลับไปตามที่ผมเคยแนะนำก็ได้) ...
exports.login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send("กรุณากรอก Email และ Password");
    }

    const sql = "SELECT * FROM user WHERE email = ?";
    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database Error");
        }

        if (results.length === 0) {
            return res.status(401).send("ไม่พบอีเมลนี้ในระบบ");
        }

        const user = results[0];

        if (password !== user.password) {
            return res.status(401).send("รหัสผ่านไม่ถูกต้อง");
        }

        res.json({
            message: "เข้าสู่ระบบสำเร็จ!",
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                img_profile: user.img_profile // [แนะนำ] ส่งรูปกลับไปตอน Login ด้วย
            }
        });
    });
};