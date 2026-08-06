const db = require('../config/db');
const { sendCommand, checkDeviceOnline } = require('../config/mqtt'); 
const { deviceCache } = require('../config/mqtt'); // ดึง cache มาใช้

// ✅ เพิ่มอุปกรณ์: ตรวจสอบเครื่องซ้ำ -> ตรวจสอบ Hardware ID จริง -> บันทึก
exports.addDevice = async (req, res) => {
    const { user_id, device_id, name } = req.body;

    try {
        // 1. ตรวจสอบในฐานข้อมูลก่อนว่ารหัสเครื่องนี้ถูกเพิ่มไปแล้วหรือยัง
        const checkSql = "SELECT id FROM devices WHERE device_id = ?";
        db.query(checkSql, [device_id], async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูล" });
            }

            if (results.length > 0) {
                // ❌ ถ้ามีเครื่องนี้ในระบบแล้ว ให้แจ้งเตือนและหยุดการทำงาน
                return res.status(400).json({ 
                    message: "รหัสเครื่องนี้ถูกลงทะเบียนในระบบแล้ว ไม่สามารถเพิ่มซ้ำได้" 
                });
            }

            // 2. ถ้ายังไม่มีใครใช้ ค่อยส่ง PING ไปหา Arduino เพื่อเช็คว่าเครื่องมีอยู่จริงและออนไลน์
            try {
                const isOnline = await checkDeviceOnline(device_id); 

                if (!isOnline) {
                    // ❌ ถ้า Arduino ไม่ตอบ (ID ผิด หรือ ไม่ได้เสียบปลั๊ก/ต่อเน็ต)
                    return res.status(404).json({ 
                        message: "ไม่มีเครื่อง ID นี้อยู่ หรือเครื่องไม่ได้เชื่อมต่อ" 
                    });
                }

                // 3. ✅ ถ้าผ่านการตรวจสอบทั้งหมด จึงจะบันทึกลง Table devices
                const insertSql = "INSERT INTO devices (user_id, device_id, name, status) VALUES (?, ?, ?, 'online')";
                db.query(insertSql, [user_id, device_id, name], (err, result) => {
                    if (err) return res.status(500).json({ message: "บันทึกข้อมูลไม่สำเร็จ" });
                    res.json({ message: "เพิ่มอุปกรณ์สำเร็จ!", id: result.insertId });
                });

            } catch (mqttError) {
                console.error("MQTT Error:", mqttError);
                res.status(500).json({ message: "เกิดข้อผิดพลาดในการเชื่อมต่อกับเครื่อง" });
            }
        });

    } catch (error) {
        console.error("System Error:", error);
        res.status(500).json({ message: "เกิดข้อผิดพลาดของระบบ" });
    }
};

// ✅ ดึงรายการอุปกรณ์: แสดงชื่อแมวที่ผูกกับ User นั้นๆ
exports.getDevices = (req, res) => {
    const { user_id } = req.params;
    const sql = `
        SELECT devices.*, 
            (SELECT name_cat FROM cats WHERE cats.user_id = devices.user_id LIMIT 1) AS name_cat 
        FROM devices WHERE devices.user_id = ?`;
    db.query(sql, [user_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Database Error" });
        res.json(results);
    });
};

// ✅ แก้ไขข้อมูลอุปกรณ์
exports.updateDevice = (req, res) => {
    const { id, device_id, name } = req.body;
    const sql = "UPDATE devices SET device_id = ?, name = ? WHERE id = ?";
    db.query(sql, [device_id, name, id], (err, result) => {
        if (err) return res.status(500).json({ message: "แก้ไขไม่สำเร็จ" });
        res.json({ message: "แก้ไขสำเร็จ" });
    });
};

// ✅ ลบอุปกรณ์
exports.deleteDevice = (req, res) => {
    const { id } = req.body;
    const sql = "DELETE FROM devices WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ message: "ลบไม่สำเร็จ" });
        res.json({ message: "ลบสำเร็จ" });
    });
};

// ------------------------------------------------------------------
// ✅ [ใหม่] เช็คว่าเครื่องยังออนไลน์อยู่จริงไหม โดยดูจาก "เวลาล่าสุด"
// ที่ mqttHandler.js อัปเดต global.deviceCache[deviceId].lastSeen
// (เครื่องส่ง /status เข้ามาทุก 5 วิ ถ้าเงียบเกิน 15 วิ ถือว่าออฟไลน์)
// ------------------------------------------------------------------
const ONLINE_THRESHOLD_MS = 15000;

function isDeviceOnline(deviceId) {
    if (!global.deviceCache) return false;
    const status = global.deviceCache[deviceId];
    if (!status || !status.lastSeen) return false;
    return (Date.now() - status.lastSeen) < ONLINE_THRESHOLD_MS;
}

// ✅ สั่งให้อาหาร: เช็คออนไลน์ก่อนเสมอ ห้ามสั่งถ้าเครื่องไม่ได้เชื่อมต่อ
exports.feedDevice = (req, res) => {
    // รับ amount มาจากแอปด้วย
    const { id, amount } = req.body; 
    
    const sql = "SELECT device_id FROM devices WHERE id = ?";
    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ message: "ไม่พบอุปกรณ์นี้ในระบบ" });
        }
        const targetDeviceId = results[0].device_id.toUpperCase(); 

        // ✅ กันการสั่งจ่ายอาหารตอนเครื่องไม่ได้เสียบปลั๊ก/ไม่ได้เชื่อมต่อ
        if (!isDeviceOnline(targetDeviceId)) {
            return res.status(400).json({ 
                message: "ไม่สามารถสั่งจ่ายอาหารได้ เนื่องจากเครื่องไม่ได้เชื่อมต่อ กรุณาตรวจสอบว่าเสียบปลั๊กและเชื่อมต่อ WiFi อยู่" 
            });
        }

        // ส่งข้อความแบบใส่ตัวเลข เช่น 'FEED_50'
        const command = `FEED_${amount || 50}`; 
        sendCommand(targetDeviceId, command); 
        
        res.json({ message: `สั่งเครื่อง ${targetDeviceId} จ่ายอาหาร ${amount} กรัมแล้ว!` });
    });
};

// ✅ ดูสถานะน้ำหนัก/น้ำ: ถ้าออฟไลน์ ไม่ส่งค่าตัวเลข (ส่ง null) พร้อม flag online ให้แอปไปแสดง UI เอง
exports.getDeviceFoodStatus = (req, res) => {
    const device_id = req.params.device_id.toUpperCase();

    // กันเหนียว เผื่อแอปยิงมาก่อนที่ Arduino จะส่งค่า
    if (!global.deviceCache) global.deviceCache = {}; 

    const online = isDeviceOnline(device_id);

    // ✅ ต้องดึงจาก global.deviceCache ให้ตรงกัน
    const status = global.deviceCache[device_id] || { tank_weight: 0, tray_weight: 0, water_low: false };
    
    console.log(`📤 [API SEND] ส่งไปที่แอป -> ${online ? '🟢 ออนไลน์' : '🔴 ออฟไลน์'} | ถัง: ${status.tank_weight}g | ถาด: ${status.tray_weight}g | น้ำ: ${status.water_low ? '⚠️ ใกล้หมด' : '✅ ปกติ'}`);
    
    res.json({
        device_id: device_id,
        online: online,
        tank_weight: online ? status.tank_weight : null,
        tray_weight: online ? status.tray_weight : null,
        water_low: online ? (status.water_low === true) : null
    });
};