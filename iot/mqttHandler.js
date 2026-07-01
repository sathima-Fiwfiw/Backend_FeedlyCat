
const { client, deviceCache } = require('../config/mqtt'); //ดึง client ที่ต่อเน็ตแล้วมาใช้ ดึง cache มาใช้
const db = require('../config/db');           // ดึงฐานข้อมูลมาใช้

// ------------------------------------------------------------------
// รับข้อมูลจาก Arduino แล้วเช็คฐานข้อมูลส่งชื่อกลับ
// ------------------------------------------------------------------
client.on('message', (topic, message) => {
    
    // 1️⃣ ตรวจสอบว่าเป็นข้อมูลการสแกนบัตร (RFID) หรือไม่
    if (topic.endsWith('/scan')) {
        try {
            const data = JSON.parse(message.toString());
            const rfid = data.rfid_tag;
            const deviceId = topic.split('/')[2]; 

            console.log(`🔍 เครื่อง ${deviceId} สแกน Tag: ${rfid}`);

            const sqlFindCat = "SELECT cat_id, name_cat FROM cats WHERE rfid_tag = ?";
            db.query(sqlFindCat, [rfid], (err, results) => {
                const resultTopic = `cat/feeder/${deviceId}/result`;
                
                if (err) {
                    console.error("❌ Database Error (ค้นหาแมว):", err);
                    return;
                }

                if (results.length > 0) {
                    const cat = results[0];
                    const catId = cat.cat_id;
                    const catName = cat.name_cat;

                    console.log(`✅ พบแมวในระบบ: ${catName} (Tag: ${rfid})`);

                    // ----------------------------------------------------------
                    // บันทึกข้อมูลลงตาราง feeding_logs
                    // ----------------------------------------------------------
                    const sqlInsertLog = "INSERT INTO feeding_logs (device_id, cat_id, status) VALUES (?, ?, 'Scanned')";
                    db.query(sqlInsertLog, [deviceId, catId], (errLog, resultLog) => {
                        if (errLog) {
                            console.error("❌ บันทึกประวัติลง feeding_logs ไม่สำเร็จ:", errLog);
                        } else {
                            console.log(`💾 บันทึกประวัติการสแกนของ '${catName}' ที่เครื่อง '${deviceId}' เรียบร้อยแล้ว`);
                        }
                    });

                    // 3. ส่งชื่อแมวกลับไปที่ Arduino
                    client.publish(resultTopic, catName);
                    
                } else {
                    client.publish(resultTopic, "UNKNOWN");
                    console.log(`❌ Access Denied: ไม่พบ Tag ${rfid} ในระบบ`);
                }
            });
        } catch (e) {
            console.error("❌ Invalid JSON received from Device (Scan payload)");
        }
    } 
    
   // 2️⃣ ตรวจสอบน้ำหนัก (เปลี่ยนมารับจาก /status ให้ตรงกับฝั่ง Arduino)
   // 2️⃣ ตรวจสอบน้ำหนัก
    else if (topic.endsWith('/status')) {
        const msgStr = message.toString();
        if (msgStr === 'ONLINE') return; 

        try {
            const data = JSON.parse(msgStr);
            const deviceId = topic.split('/')[2].toUpperCase(); 

            if (data.tank_weight !== undefined) {
                // ✅ สร้าง global.deviceCache ถ้ายังไม่มี
                if (!global.deviceCache) global.deviceCache = {};
                
                // ✅ บันทึกลงตัวแปร Global
                global.deviceCache[deviceId] = {
                    tank_weight: data.tank_weight,
                    tray_weight: data.tray_weight
                };
                console.log(`⚖️ [RAM Cache] เครื่อง ${deviceId} | ถัง: ${data.tank_weight}g | ถาด: ${data.tray_weight}g`);
            }
        } catch (e) {
            console.error("❌ Invalid JSON received (Status payload)", e.message);
        }
    }
});