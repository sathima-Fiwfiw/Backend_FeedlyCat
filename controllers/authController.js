const db = require('../config/db');


//register
// ในไฟล์ controllers/authController.js (ฝั่ง Backend)

exports.register = (req, res) => {
    const { name, email, password, phone } = req.body;

    // 1. Validation พื้นฐาน
    if (!name || !email || !password || !phone) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
    }

    // 2. เช็คความยาวรหัสผ่าน (กันเหนียวอีกรอบที่ฝั่ง Server)
    if (password.length < 6) {
        return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
    }

    // 3. เช็คว่า Email หรือ Phone มีในระบบหรือยัง?
    // ใช้ SQL OR เพื่อหาว่ามีอันใดอันหนึ่งซ้ำไหม
    const checkSql = "SELECT * FROM user WHERE email = ? OR phone = ?";
    
    db.query(checkSql, [email, phone], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database Error" });
        }

        // ถ้าเจอข้อมูลซ้ำ (results ไม่ว่างเปล่า)
        if (results.length > 0) {
            const existingUser = results[0];
            
            // เช็คเจาะจงว่าอะไรซ้ำ จะได้แจ้ง User ถูก
            if (existingUser.email === email) {
                return res.status(400).json({ message: "Email นี้ถูกใช้งานแล้ว" });
            }
            if (existingUser.phone === phone) {
                return res.status(400).json({ message: "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว" });
            }
        }

        // 4. ถ้าไม่ซ้ำ -> บันทึกลงฐานข้อมูล
        const insertSql = "INSERT INTO user (name, email, password, phone) VALUES (?, ?, ?, ?)";
        db.query(insertSql, [name, email, password, phone], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "เกิดข้อผิดพลาดในการสมัครสมาชิก" });
            }
            
            res.json({
                message: "สมัครสมาชิกเรียบร้อย!",
                user_id: result.insertId,
                name: name
            });
        });
    });
};

// ... Login ...

exports.login = (req, res) => {
    // 1. รับค่า email และ password
    const { email, password } = req.body;

    // 2. เช็คว่ากรอกมาครบไหม
    if (!email || !password) {
        return res.status(400).send("กรุณากรอก Email และ Password");
    }

    // 3. ค้นหา User จาก Email
    const sql = "SELECT * FROM user WHERE email = ?";
    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database Error");
        }

        // ถ้าหาไม่เจอ (results ว่างเปล่า)
        if (results.length === 0) {
            return res.status(401).send("ไม่พบอีเมลนี้ในระบบ");
        }

        // ถ้าเจอ user ให้ดึงข้อมูลมาเก็บไว้ตัวแปร
        const user = results[0];

        // 4. เช็ครหัสผ่าน (เปรียบเทียบรหัสที่ส่งมา กับรหัสในฐานข้อมูล)
        if (password !== user.password) {
            return res.status(401).send("รหัสผ่านไม่ถูกต้อง");
        }

        // 5. ถ้าทุกอย่างถูกต้อง -> ส่งข้อมูลกลับไป
        res.json({
            message: "เข้าสู่ระบบสำเร็จ!",
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });
    });
};