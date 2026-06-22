const { client } = require('../config/mqtt'); // ดึง client ที่ต่อเน็ตแล้วมาใช้
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
    
    // 2️⃣ ตรวจสอบว่าเป็นข้อมูลน้ำหนักอาหาร (Load Cell) หรือไม่
    else if (topic.endsWith('/weight')) {
        try {
            const data = JSON.parse(message.toString());
            const weight = data.weight;
            const deviceId = topic.split('/')[2]; 

            console.log(`⚖️ เครื่อง ${deviceId} ปริมาณอาหารเหลือ: ${weight} กรัม`);

            // อัปเดตค่าน้ำหนักลง Database (ตาราง devices)
            const sqlUpdateWeight = "UPDATE devices SET food_remain = ? WHERE device_id = ?";
            db.query(sqlUpdateWeight, [weight, deviceId], (err, result) => {
                if (err) console.error("❌ อัปเดตน้ำหนักอาหารไม่สำเร็จ:", err);
            });
        } catch (e) {
            console.error("❌ Invalid JSON received from Device (Weight payload)");
        }
    }

});