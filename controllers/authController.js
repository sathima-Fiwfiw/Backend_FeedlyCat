const db = require('../config/db');
const nodemailer = require('nodemailer'); // ลืมรหัสผ่าน
// Register
exports.register = (req, res) => {
    const { name, email, password, phone } = req.body;
    
    const img_profile = req.file ? req.file.path : null;
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
                img_profile: img_profile 
            });
        });
    });
};

// Login 
exports.login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        // แก้จาก .send เป็น .json
        return res.status(400).json({ message: "กรุณากรอก Email และ Password" });
    }

    const sql = "SELECT * FROM user WHERE email = ?";
    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error(err);
            // แก้ตรงนี้สำคัญมาก!
            return res.status(500).json({ message: "Database Error" });
        }

        if (results.length === 0) {
            // แก้จาก .send เป็น .json
            return res.status(401).json({ message: "ไม่พบอีเมลนี้ในระบบ" });
        }

        const user = results[0];

        if (password !== user.password) {
            // แก้จาก .send เป็น .json
            return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
        }
        res.json({
            message: "เข้าสู่ระบบสำเร็จ!",
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                img_profile: user.img_profile 
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

  db.query(sql, [email], (err, results) => {
    if (err) {
        console.error(err);
        // ❌ ของเดิม: return res.status(500).send("Database Error");
        // ✅ เปลี่ยนเป็น:
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

// ฟังก์ชันลืมรหัสผ่าน (ส่ง OTP)
exports.forgotPassword = (req, res) => {
    // 1. รับค่า email มาเป็นอันดับแรกสุด! (สำคัญมาก)
    const { email } = req.body;
    if (!email) {
        return res.status(400).send("กรุณากรอกอีเมล");
    }
    // 2. เช็คว่ามี User อีเมลนี้ในระบบไหม?
    db.query("SELECT * FROM user WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).send("Database Error");
        if (results.length === 0) return res.status(404).send("ไม่พบอีเมลนี้ในระบบ");
        // 3. สร้าง OTP สุ่ม 6 หลัก
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        // 4. ลบ Token เก่าทิ้งก่อน (ถ้ามี)
        db.query("DELETE FROM password_resets WHERE email = ?", [email], (err) => {
            if (err) console.log(err);
            // 5. บันทึก Token ใหม่ลง Database
            const insertSql = "INSERT INTO password_resets (email, token) VALUES (?, ?)";
            db.query(insertSql, [email, token], (err) => {
                if (err) return res.status(500).send("สร้าง Token ไม่สำเร็จ");
                // 6. ตั้งค่าคนส่ง (Transporter)
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: 'feedlycat@gmail.com',  
                        pass: 'mfeoaceujplpizec'     
                    }
                });
                const mailOptions = {
                    from: 'FeedlyCat App <feedlycat@gmail.com>', // ชื่อผู้ส่ง
                    to: email, 
                    subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน (FeedlyCat)',
                    html: `
                        <div style="font-family: 'Sarabun', sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #ffffff;">
                            <h2 style="color: #4FC3F7; text-align: center;">FeedlyCat 🐱</h2>
                            <hr style="border: 0; border-top: 1px solid #eee;">
                            
                            <p style="font-size: 16px; color: #333;">สวัสดีฮ้ะ,</p>
                            <p style="font-size: 16px; color: #333;">เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ นี่คือรหัส OTP ของคุณ:</p>
                            
                            <div style="background-color: #E3F2FD; padding: 15px; text-align: center; border-radius: 10px; margin: 20px 0;">
                                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0277BD;">${token}</span>
                            </div>
                            
                            <p style="font-size: 14px; color: #777;">รหัสนี้มีอายุการใช้งาน <strong>15 นาที</strong> เท่านั้น</p>
                            <p style="font-size: 14px; color: #777;">หากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยต่ออีเมลฉบับนี้</p>
                            
                            <hr style="border: 0; border-top: 1px solid #eee;">
                            <p style="font-size: 12px; color: #aaa; text-align: center;">FeedlyCat Application</p>
                        </div>
                    `
                };
                // 8. ส่งเมล
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.log(error);
                        return res.status(500).send("ส่งอีเมลไม่สำเร็จ");
                    }
                    res.json({ message: "ส่งรหัส OTP ไปที่อีเมลเรียบร้อยแล้ว" });
                });
            });
        });
    });
};

// ฟังก์ชันลืมรหัสแล้วตั้งรหัสผ่านใหม่ (Reset Password)
exports.resetPassword = (req, res) => {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
        return res.status(400).send("ข้อมูลไม่ครบถ้วน");
    }
    const sql = `SELECT * FROM password_resets 
                 WHERE email = ? 
                 AND token = ? 
                 AND created_at > NOW() - INTERVAL 15 MINUTE`;

    db.query(sql, [email, token], (err, results) => {
        if (err) return res.status(500).send("Database Error");

        if (results.length === 0) {
            return res.status(400).send("รหัส OTP ไม่ถูกต้อง หรือหมดอายุแล้ว");
        }

        // 2. ถ้าผ่าน -> อัปเดตรหัสผ่านใหม่ที่ตาราง User
        const updateSql = "UPDATE user SET password = ? WHERE email = ?";
        db.query(updateSql, [newPassword, email], (err) => {
            if (err) return res.status(500).send("Update Password Error");

            // 3. ลบ Token ทิ้งทันทีเมื่อใช้เสร็จแล้ว
            db.query("DELETE FROM password_resets WHERE email = ?", [email], (err) => {
                res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบใหม่" });
            });
        });
    });
};

// ฟังก์ชันเปลี่ยนรหัสผ่าน (Change Password)
exports.changePassword = (req, res) => {
    const { user_id, oldPassword, newPassword } = req.body;

    // 1. เช็คข้อมูลครบถ้วน
    if (!user_id || !oldPassword || !newPassword) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    // 2. ดึงรหัสผ่านเดิมจาก Database มาเทียบ
    db.query("SELECT password FROM user WHERE user_id = ?", [user_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        if (results.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

        const user = results[0];

        // 3. ตรวจสอบว่ารหัสเดิมถูกต้องไหม
        if (user.password !== oldPassword) {
            return res.status(401).json({ message: "รหัสผ่านเดิมไม่ถูกต้อง" });
        }

        // 4. ถ้าถูก -> อัปเดตรหัสใหม่
        db.query("UPDATE user SET password = ? WHERE user_id = ?", [newPassword, user_id], (err) => {
            if (err) return res.status(500).json({ message: "Update Error" });
            res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ!" });
        });
    });
};