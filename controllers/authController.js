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


// ฟังก์ชันแก้ไขโปรไฟล์
exports.updateProfile = (req, res) => {
    const { user_id, name } = req.body;
    
    // เช็คว่ามีการส่งไฟล์รูปมาใหม่ไหม?
    // ถ้ามี: ใช้ลิงค์ใหม่จาก Cloudinary (req.file.path)
    // ถ้าไม่มี: ให้เป็น null (เดี๋ยวเราจะเขียน logic ไม่ให้ทับของเดิม)
    const new_img_profile = req.file ? req.file.path : null;

    if (!user_id || !name) {
        return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    let sql = "";
    let params = [];

    if (new_img_profile) {
        // กรณี: เปลี่ยนรูปด้วย (อัปเดตทั้งชื่อและรูป)
        sql = "UPDATE user SET name = ?, img_profile = ? WHERE user_id = ?";
        params = [name, new_img_profile, user_id];
    } else {
        // กรณี: เปลี่ยนแค่ชื่อ (รูปเดิม)
        sql = "UPDATE user SET name = ? WHERE user_id = ?";
        params = [name, user_id];
    }

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database Error" });
        }

        // ส่งข้อมูลล่าสุดกลับไปให้ Frontend อัปเดตหน้าจอทันที
        res.json({
            message: "อัปเดตข้อมูลสำเร็จ!",
            user: {
                user_id: user_id,
                name: name,
                img_profile: new_img_profile // ถ้าไม่ได้เปลี่ยนรูป ค่านี้จะเป็น null (Frontend ต้องจัดการต่อเอง)
            }
        });
    });
};