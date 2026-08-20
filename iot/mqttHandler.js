const { client, deviceCache } = require('../config/mqtt'); //ดึง client ที่ต่อเน็ตแล้วมาใช้ ดึง cache มาใช้
const db = require('../config/db');           // ดึงฐานข้อมูลมาใช้

// ------------------------------------------------------------------
// รับข้อมูลจาก Arduino แล้วเช็คฐานข้อมูลส่งชื่อกลับ
// ------------------------------------------------------------------
client.on('message', (topic, message) => {

    //อัปเดตเวลาล่าสุดที่ได้รับข้อความจากเครื่องนี้
    // ทุก topic ที่เข้ามา (scan, status, eaten) ถือว่าเครื่องยังออนไลน์อยู่
    // devicesController.js จะเอา lastSeen นี้ไปเช็คว่าเครื่อง online/offline
    const topicParts = topic.split('/');
    if (topicParts.length >= 3) {
        const msgDeviceId = topicParts[2].toUpperCase();
        if (!global.deviceCache) global.deviceCache = {};
        if (!global.deviceCache[msgDeviceId]) {
            global.deviceCache[msgDeviceId] = { tank_weight: 0, tray_weight: 0, water_low: false };
        }
        global.deviceCache[msgDeviceId].lastSeen = Date.now();
    }

    // 1️ ตรวจสอบว่าเป็นข้อมูลการสแกนบัตร (RFID) หรือไม่ แมวเข้ามากินอาหาร
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

                    // บันทึกข้อมูลลงตาราง feeding_logs (สถานะเริ่มต้น = กำลังกิน) 
                    const sqlInsertLog = "INSERT INTO feeding_logs (device_id, cat_id, status) VALUES (?, ?, 'Scanned')";
                    db.query(sqlInsertLog, [deviceId, catId], (errLog, resultLog) => {
                        if (errLog) {
                            console.error("❌ บันทึกประวัติลง feeding_logs ไม่สำเร็จ:", errLog);
                        } else {
                            console.log(`💾 บันทึกประวัติการสแกนของ '${catName}' ที่เครื่อง '${deviceId}' เรียบร้อยแล้ว (log id: ${resultLog.insertId})`);
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
    else if (topic.endsWith('/status')) {
        const msgStr = message.toString();
        if (msgStr === 'ONLINE') return; 

        try {
            const data = JSON.parse(msgStr);
            const deviceId = topic.split('/')[2].toUpperCase(); 

            if (data.tank_weight !== undefined) {
                //  สร้าง global.deviceCache ถ้ายังไม่มี
                if (!global.deviceCache) global.deviceCache = {};
                
                //  บันทึกลงตัวแปร Global (รวม water_low ที่ Arduino ส่งมาจากเซนเซอร์ XKC-Y25V)
                //  ใช้ ...global.deviceCache[deviceId] เพื่อไม่ให้ lastSeen ที่เพิ่งเซ็ตด้านบนหาย
                global.deviceCache[deviceId] = {
                    ...global.deviceCache[deviceId],
                    tank_weight: data.tank_weight,
                    tray_weight: data.tray_weight,
                    water_low: data.water_low === true, // กันเหนียวกรณี field หาย ให้ default เป็น false
                    is_eating: data.is_eating === true 
                };
                console.log(`⚖️ [RAM Cache] เครื่อง ${deviceId} | ถัง: ${data.tank_weight}g | ถาด: ${data.tray_weight}g | น้ำ: ${data.water_low ? '⚠️ ใกล้หมด' : '✅ ปกติ'}`);

                // ✅ ทุกครั้งที่ได้น้ำหนักถังใหม่ ให้เช็คกับเกณฑ์แจ้งเตือนที่ตั้งไว้ทันที
                checkLowFoodAlert(deviceId, data.tank_weight);

                // ✅ เช็คสถานะน้ำจากเซนเซอร์ XKC-Y25V ทุกครั้งที่ได้รับ /status ด้วย
                checkLowWaterAlert(deviceId, data.water_low === true);
            }
        } catch (e) {
            console.error("❌ Invalid JSON received (Status payload)", e.message);
        }
    }

    // 4️⃣ ✅ NEW: เครื่องขอตรวจสอบว่าตัวเองลงทะเบียนในระบบแล้วหรือยัง (ส่งมาตอนบูตหรือ MQTT reconnect)
    else if (topic.endsWith('/verify')) {
        const msgStr = message.toString();
        if (msgStr !== 'CHECK') return; // กันข้อความแปลกปลอม

        const deviceId = topic.split('/')[2].toUpperCase();
        const verifyResultTopic = `cat/feeder/${deviceId}/verify_result`;

        console.log(`🔎 เครื่อง ${deviceId} ขอตรวจสอบการลงทะเบียน...`);

        const sqlCheckDevice = "SELECT id FROM devices WHERE UPPER(device_id) = ?";
        db.query(sqlCheckDevice, [deviceId], (err, results) => {
            if (err) {
                console.error("❌ Database Error (ตรวจสอบการลงทะเบียนเครื่อง):", err);
                // ไม่ publish อะไรกลับตอน error ฝั่ง DB — ให้ Arduino ส่ง CHECK มาใหม่ในรอบถัดไป (retry ทุก 10 วิ)
                return;
            }

            if (results.length > 0) {
                client.publish(verifyResultTopic, "OK");
                console.log(`✅ เครื่อง ${deviceId} พบในระบบแล้ว -> ตอบกลับ OK`);
            } else {
                client.publish(verifyResultTopic, "UNKNOWN");
                console.log(`❌ เครื่อง ${deviceId} ยังไม่พบในระบบ -> ตอบกลับ UNKNOWN`);
            }
        });
    }

    // 3️⃣ ✅ ใหม่: แมวกินเสร็จแล้ว (Arduino คำนวณปริมาณที่กินและส่งมา)
    else if (topic.endsWith('/eaten')) {
        try {
            const data = JSON.parse(message.toString());
            const rfid = data.rfid_tag;
            const amountEaten = data.amount_eaten;
            const deviceId = topic.split('/')[2];

            console.log(`🍗 เครื่อง ${deviceId} รายงานปริมาณที่กิน: ${amountEaten}g (Tag: ${rfid})`);

            if (!rfid || amountEaten === undefined) {
                console.error("❌ ข้อมูล eaten payload ไม่ครบ (ต้องมี rfid_tag และ amount_eaten)");
                return;
            }

            // ✅ ถ้าน้ำหนักที่กินเป็น 0 (แมวไม่ได้กินจริง แค่มาสแกนแล้วเดินออก) ไม่ต้องบันทึกลง DB
            if (amountEaten <= 0) {
                console.log(`⏭️ เครื่อง ${deviceId} รายงานปริมาณที่กิน = 0g (Tag: ${rfid}) — ข้ามการบันทึก`);
                return;
            }

            // หา cat_id จาก rfid_tag ก่อน
            const sqlFindCat = "SELECT cat_id, name_cat FROM cats WHERE rfid_tag = ?";
            db.query(sqlFindCat, [rfid], (err, results) => {
                if (err) {
                    console.error("❌ Database Error (ค้นหาแมวสำหรับบันทึกการกิน):", err);
                    return;
                }
                if (results.length === 0) {
                    console.log(`❌ ไม่พบแมว Tag ${rfid} ในระบบ ไม่สามารถบันทึกปริมาณที่กินได้`);
                    return;
                }

                const catId = results[0].cat_id;
                const catName = results[0].name_cat;

                // อัปเดตแถวล่าสุดของ feeding_logs ที่ยังค้างสถานะ 'Scanned'
                // ของ device+cat คู่นี้ ให้ใส่ปริมาณที่กิน (food) และปิดสถานะเป็น 'Completed'
                const sqlUpdateLog = `
                    UPDATE feeding_logs 
                    SET food = ?, status = 'Completed' 
                    WHERE device_id = ? AND cat_id = ? AND status = 'Scanned'
                    ORDER BY log_id DESC 
                    LIMIT 1
                `;
                db.query(sqlUpdateLog, [amountEaten, deviceId, catId], (errUpdate, result) => {
                    if (errUpdate) {
                        console.error("❌ อัปเดตปริมาณที่กินลง feeding_logs ไม่สำเร็จ:", errUpdate);
                        return;
                    }
                    if (result.affectedRows === 0) {
                        console.warn(`⚠️ ไม่พบแถว 'Scanned' ที่รอปิดของ ${catName} (device: ${deviceId}) — อาจถูกอัปเดตไปแล้ว หรือไม่มีการสแกนก่อนหน้า`);
                        return;
                    }
                    console.log(`💾 บันทึกปริมาณที่กินของ '${catName}' ที่เครื่อง '${deviceId}' = ${amountEaten}g เรียบร้อยแล้ว`);
                });
            });
        } catch (e) {
            console.error("❌ Invalid JSON received (Eaten payload)", e.message);
        }
    }
});


//แจ้งเตือนอาหารใกล้หมด 
//  เช็คเกณฑ์แจ้งเตือนอาหารใกล้หมด (เทียบน้ำหนักถังกับค่าที่ตั้งไว้ในหน้าแอป)
// เรียกทุกครั้งที่ได้รับ /status จาก Arduino (ทุก ~5 วินาที)

// เก็บสถานะ "แจ้งเตือนไปแล้วหรือยัง" ของแต่ละเครื่องไว้ใน RAM
// เพื่อไม่ให้สร้าง notification ซ้ำทุก 5 วินาทีตราบใดที่น้ำหนักยังต่ำกว่าเกณฑ์อยู่
if (!global.lowFoodAlerted) global.lowFoodAlerted = {};

function checkLowFoodAlert(deviceId, tankWeight) {
    const sqlGetThreshold = "SELECT title, threshold_gram FROM device_alert_settings WHERE device_id = ?";
    db.query(sqlGetThreshold, [deviceId], (err, rows) => {
        if (err) {
            console.error("❌ Database Error (เช็คเกณฑ์แจ้งเตือน):", err);
            return;
        }
        if (rows.length === 0) return; // เครื่องนี้ยังไม่เคยตั้งค่าแจ้งเตือนไว้

        const { title, threshold_gram } = rows[0];

        if (tankWeight <= threshold_gram) {
            // ต่ำกว่าเกณฑ์ -> แจ้งเตือนแค่ครั้งเดียวต่อรอบ (จนกว่าจะเติมอาหารแล้วน้ำหนักกลับขึ้นไปสูงกว่าเกณฑ์)
            if (!global.lowFoodAlerted[deviceId]) {
                const message = `อาหารในถังเหลือ ${tankWeight}g (ต่ำกว่าที่ตั้งไว้ ${threshold_gram}g)`;
                const sqlInsertNoti = "INSERT INTO notifications (device_id, title, message, is_read, created_at) VALUES (?, ?, ?, 0, NOW())";
                db.query(sqlInsertNoti, [deviceId, title, message], (errN) => {
                    if (errN) {
                        console.error("❌ บันทึกแจ้งเตือนอาหารใกล้หมดไม่สำเร็จ:", errN);
                        return;
                    }
                    console.log(`🔔 [แจ้งเตือน] เครื่อง ${deviceId} อาหารเหลือ ${tankWeight}g ต่ำกว่าเกณฑ์ ${threshold_gram}g`);
                });
                global.lowFoodAlerted[deviceId] = true;
            }
        } else {
            // น้ำหนักกลับสูงกว่าเกณฑ์แล้ว (เช่น เติมอาหารใหม่) -> reset ไว้ เผื่อรอบหน้าจะได้แจ้งเตือนใหม่ได้อีก
            if (global.lowFoodAlerted[deviceId]) {
                console.log(`✅ เครื่อง ${deviceId} อาหารกลับมาเพียงพอแล้ว (${tankWeight}g) — รีเซ็ตสถานะแจ้งเตือน`);
            }
            global.lowFoodAlerted[deviceId] = false;
        }
    });
}

// เช็คสถานะน้ำใกล้หมด (จากเซนเซอร์ XKC-Y25V ที่ Arduino ส่งมาเป็น water_low: true/false)
// เรียกทุกครั้งที่ได้รับ /status จาก Arduino (ทุก ~5 วินาที) เหมือนกับของอาหาร

// เก็บสถานะ "แจ้งเตือนไปแล้วหรือยัง" ของแต่ละเครื่องไว้ใน RAM
// เพื่อไม่ให้สร้าง notification ซ้ำทุก 5 วินาทีตราบใดที่น้ำยังใกล้หมดอยู่
if (!global.lowWaterAlerted) global.lowWaterAlerted = {};

function checkLowWaterAlert(deviceId, waterLow) {
    if (waterLow) {
        // น้ำใกล้หมด -> แจ้งเตือนแค่ครั้งเดียวต่อรอบ (จนกว่าจะเติมน้ำแล้วเซนเซอร์กลับมาปกติ)
        if (!global.lowWaterAlerted[deviceId]) {
            const title = "น้ำใกล้หมด";
            const message = "ตรวจไม่พบน้ำในถัง กรุณาเติมน้ำให้แมวด้วยนะ";
            const sqlInsertNoti = "INSERT INTO notifications (device_id, title, message, is_read, created_at) VALUES (?, ?, ?, 0, NOW())";
            db.query(sqlInsertNoti, [deviceId, title, message], (errN) => {
                if (errN) {
                    console.error("❌ บันทึกแจ้งเตือนน้ำใกล้หมดไม่สำเร็จ:", errN);
                    return;
                }
                console.log(`🔔 [แจ้งเตือน] เครื่อง ${deviceId} ตรวจไม่พบน้ำในถัง`);
            });
            global.lowWaterAlerted[deviceId] = true;
        }
    } else {
        // เซนเซอร์ตรวจพบน้ำกลับมาปกติแล้ว (เช่น เติมน้ำใหม่) -> reset ไว้ เผื่อรอบหน้าจะได้แจ้งเตือนใหม่ได้อีก
        if (global.lowWaterAlerted[deviceId]) {
            console.log(`✅ เครื่อง ${deviceId} มีน้ำเพียงพอแล้ว — รีเซ็ตสถานะแจ้งเตือนน้ำ`);
        }
        global.lowWaterAlerted[deviceId] = false;
    }
}