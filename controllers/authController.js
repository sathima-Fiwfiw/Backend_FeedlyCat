const db = require('../config/db');
const bcrypt = require('bcryptjs'); // ✅ ใช้แฮสรหัสผ่าน (ต้องรัน: npm install bcryptjs)
const SALT_ROUNDS = 10;
// ✅ เปลี่ยนจาก Resend มาเป็น Brevo (Sendinblue) — ใช้ HTTP API ตรงๆ ผ่าน fetch ไม่ต้องลง package เพิ่ม
const BREVO_API_KEY = process.env.BREVO_API_KEY; // ดึง API Key จาก Environment Variable
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'feedlycat@gmail.com'; // ต้องไป verify อีเมลนี้ใน Brevo dashboard ก่อน (Senders > Add a sender)
const BREVO_SENDER_NAME = 'FeedlyCat App';

// ฟังก์ชันช่วยส่งอีเมลผ่าน Brevo API เพราะ rander ฟรี บล็อค smtp เลยใช้ brevo ช่วยส่งแทน
async function sendBrevoEmail({ to, subject, html }) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'api-key': BREVO_API_KEY,
        },
        body: JSON.stringify({
            sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        // Brevo จะส่ง error กลับมาเป็น JSON เช่น { code, message }
        throw new Error(data.message || `Brevo API Error (status ${response.status})`);
    }

    return data;
}

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
    db.query(checkSql, [email, phone], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        if (results.length > 0) {
            const existingUser = results[0];
            if (existingUser.email === email) return res.status(400).json({ message: "Email นี้ถูกใช้งานแล้ว" });
            if (existingUser.phone === phone) return res.status(400).json({ message: "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" });
        }

        // ✅ แฮสรหัสผ่านก่อนเก็บลง Database (ไม่เก็บ plain text)
        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        } catch (e) {
            return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน" });
        }

        const insertSql = "INSERT INTO user (name, email, password, phone, img_profile, is_verified) VALUES (?, ?, ?, ?, ?, 0)";
        db.query(insertSql, [name, email, hashedPassword, phone, img_profile], async (err, result) => {
            if (err) return res.status(500).json({ message: "เกิดข้อผิดพลาดในการสมัครสมาชิก" });

            const token = Math.floor(100000 + Math.random() * 900000).toString();
            db.query("DELETE FROM password_resets WHERE email = ?", [email], async () => {
                db.query("INSERT INTO password_resets (email, token) VALUES (?, ?)", [email, token], async (err) => {
                    if (err) return res.status(500).json({ message: "สร้าง OTP ไม่สำเร็จ" });

                    try {
                        await sendBrevoEmail({
                            to: email,
                            subject: 'ยืนยันอีเมลของคุณ (FeedlyCat)',
                            html: `<h2>รหัสยืนยัน: ${token}</h2><p>หมดอายุใน 15 นาที</p>`,
                        });
                        res.json({
                            message: "สมัครสมาชิกสำเร็จ กรุณายืนยัน OTP ที่ส่งไปยังอีเมล",
                            user_id: result.insertId,
                            email: email,
                        });
                    } catch (e) {
                        console.log("Brevo Error:", e.message);
                        // ยังให้สมัครผ่าน แม้ส่งเมลพลาด เผื่อ resend ทีหลัง
                        res.json({ message: "สมัครสำเร็จ แต่ส่งอีเมลไม่สำเร็จ กรุณาขอ OTP ใหม่", user_id: result.insertId, email });
                    }
                });
            });
        });
    });
};

// Login 
exports.login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "กรุณากรอก Email และ Password" });
    }

    const sql = "SELECT * FROM user WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database Error" });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: "ไม่พบอีเมลนี้ในระบบ" });
        }

        const user = results[0];

        // ✅ เทียบรหัสผ่านที่กรอกกับ hash ที่เก็บไว้ใน Database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
        }
        if (user.is_verified === 0) {
            return res.status(403).json({ message: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ" });
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
    
    // เช็คว่ามีการส่งไฟล์รูปมาใหม่ไหม
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

    db.query(sql, params, (err, results) => {
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

// ฟังก์ชันลืมรหัสผ่าน (ส่ง OTP)
exports.forgotPassword = (req, res) => {
    // 1. รับค่า email มาเป็นอันดับแรกสุด
    const { email } = req.body;
    if (!email) {
        return res.status(400).send("กรุณากรอกอีเมล");
    }
    // 2. เช็คว่ามี User อีเมลนี้ในระบบไหม
    db.query("SELECT * FROM user WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).send("Database Error");
        if (results.length === 0) return res.status(404).send("ไม่พบอีเมลนี้ในระบบ");
        // 3. สร้าง OTP สุ่ม 6 หลัก
        const token = Math.floor(100000 + Math.random() * 900000).toString();
        // 4. ลบ Token เก่าทิ้งก่อน
        db.query("DELETE FROM password_resets WHERE email = ?", [email], (err) => {
            if (err) console.log(err);
            // 5. บันทึก Token ใหม่ลง Database
            const insertSql = "INSERT INTO password_resets (email, token) VALUES (?, ?)";
            db.query(insertSql, [email, token], async (err) => {
                if (err) return res.status(500).send("สร้าง Token ไม่สำเร็จ");

                // 6.  ส่งเมลผ่าน Resend 
                //    ใช้ HTTP API ไม่ใช่ SMTP port 
                const htmlContent = `
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
                `;

                try {
                    const data = await sendBrevoEmail({
                        to: email,
                        subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน (FeedlyCat)',
                        html: htmlContent,
                    });

                    console.log("✅ ส่งอีเมลสำเร็จ:", data);
                    res.json({ message: "ส่งรหัส OTP ไปที่อีเมลเรียบร้อยแล้ว" });

                } catch (err) {
                    console.log("❌ Brevo Error:", err.message);
                    return res.status(500).send("ส่งอีเมลไม่สำเร็จ");
                }
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

    db.query(sql, [email, token], async (err, results) => {
        if (err) return res.status(500).send("Database Error");

        if (results.length === 0) {
            return res.status(400).send("รหัส OTP ไม่ถูกต้อง หรือหมดอายุแล้ว");
        }

        // ✅ แฮสรหัสผ่านใหม่ก่อนบันทึก
        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        } catch (e) {
            return res.status(500).send("เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน");
        }

        // 2. ถ้าผ่าน -> อัปเดตรหัสผ่านใหม่ที่ตาราง User
        const updateSql = "UPDATE user SET password = ? WHERE email = ?";
        db.query(updateSql, [hashedPassword, email], (err) => {
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
    db.query("SELECT password FROM user WHERE user_id = ?", [user_id], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        if (results.length === 0) return res.status(404).json({ message: "ไม่พบผู้ใช้" });

        const user = results[0];

        // 3. ตรวจสอบว่ารหัสเดิมถูกต้องไหม
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "รหัสผ่านเดิมไม่ถูกต้อง" });
        }

        // ✅ แฮสรหัสผ่านใหม่ก่อนบันทึก
        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        } catch (e) {
            return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้ารหัสรหัสผ่าน" });
        }

        // 4. ถ้าถูก -> อัปเดตรหัสใหม่
        db.query("UPDATE user SET password = ? WHERE user_id = ?", [hashedPassword, user_id], (err) => {
            if (err) return res.status(500).json({ message: "Update Error" });
            res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ!" });
        });
    });
};

//ตรวจสอบ OTP/Token เพื่อยืนยันอีเมลของผู้ใช้ แล้วเปลี่ยนสถานะผู้ใช้เป็นยืนยันตัวตนแล้ว (is_verified = 1)
exports.verifyEmail = (req, res) => {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });

    const sql = `SELECT * FROM password_resets WHERE email = ? AND token = ? AND created_at > NOW() - INTERVAL 15 MINUTE`;
    db.query(sql, [email, token], (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        if (results.length === 0) return res.status(400).json({ message: "รหัส OTP ไม่ถูกต้องหรือหมดอายุ" });

        db.query("UPDATE user SET is_verified = 1 WHERE email = ?", [email], (err) => {
            if (err) return res.status(500).json({ message: "Update Error" });
            db.query("DELETE FROM password_resets WHERE email = ?", [email], () => {
                res.json({ message: "ยืนยันอีเมลสำเร็จ! กรุณาเข้าสู่ระบบ" });
            });
        });
    });
};