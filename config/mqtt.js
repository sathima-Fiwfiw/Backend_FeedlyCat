require('dotenv').config();
const mqtt = require('mqtt');
const db = require('../config/db'); // ✅ นำเข้าการเชื่อมต่อ Database ของคุณ 

let connectUrl = process.env.MQTT_HOST;
if (connectUrl && !connectUrl.startsWith('mqtt')) {
    connectUrl = `mqtts://${connectUrl}`; 
}

const client = mqtt.connect(connectUrl, {
    port: process.env.MQTT_PORT,
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
});

client.on('connect', () => {
    console.log('✅ MQTT Connected Successfully!');
    // ✅ Subscribe topic ที่ Arduino จะส่งข้อมูลสแกนมา
    client.subscribe('cat/feeder/+/scan'); 
});

// ------------------------------------------------------------------
// ✅ ส่วนที่เพิ่มใหม่: รับข้อมูลจาก Arduino แล้วเช็คฐานข้อมูลส่งชื่อกลับ
// ------------------------------------------------------------------
client.on('message', (topic, message) => {
    // ตรวจสอบว่าเป็น Topic การสแกนหรือไม่ (เช่น cat/feeder/FEEDER_001/scan)
    if (topic.endsWith('/scan')) {
        try {
            const data = JSON.parse(message.toString());
            const rfid = data.rfid_tag;
            const deviceId = topic.split('/')[2]; // ดึง FEEDER_001 ออกมาจาก Topic

            console.log(`🔍 เครื่อง ${deviceId} สแกน Tag: ${rfid}`);

            // 1. ค้นหาชื่อแมวและ ID จาก rfid_tag ในฐานข้อมูล 
            // (ต้องดึง cat_id มาด้วยเพื่อเอาไปบันทึกลง feeding_logs)
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

                    // 2. บันทึกข้อมูลลงตาราง feeding_logs ทันที
                    // กำหนด status เป็น 'Scanned' เพื่อบอกว่ามาระบุตัวตน (ยังไม่กิน/จ่ายอาหาร)
                    const sqlInsertLog = "INSERT INTO feeding_logs (cat_id, status) VALUES (?, 'Scanned')";
                    db.query(sqlInsertLog, [catId], (errLog, resultLog) => {
                        if (errLog) {
                            console.error("❌ บันทึกประวัติลง feeding_logs ไม่สำเร็จ:", errLog);
                        } else {
                            console.log(`💾 บันทึกประวัติการสแกนของ '${catName}' เรียบร้อยแล้ว`);
                        }
                    });

                    // 3. ส่งชื่อแมวกลับไปที่ Arduino เพื่อให้แสดงผล
                    client.publish(resultTopic, catName);
                    
                } else {
                    // ❌ ไม่พบแมว: ส่ง UNKNOWN เพื่อให้ Arduino ปฏิเสธการทำงาน
                    client.publish(resultTopic, "UNKNOWN");
                    console.log(`❌ Access Denied: ไม่พบ Tag ${rfid} ในระบบ`);
                }
            });
        } catch (e) {
            console.error("❌ Invalid JSON received from Device");
        }
    }
});

//get ชื่อแมวจาก rfid_tag (สำหรับทดสอบ)
const checkDeviceOnline = (deviceId) => {
    return new Promise((resolve) => {
        if (!client.connected) return resolve(false);

        const checkTopic = `cat/feeder/${deviceId}/command`; 
        const responseTopic = `cat/feeder/${deviceId}/status`; 
        let timeoutHandle;

        const cleanup = () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            client.removeListener('message', messageHandler);
            client.unsubscribe(responseTopic);
        };

        const messageHandler = (topic, message) => {
            if (topic === responseTopic && message.toString() === 'ONLINE') {
                cleanup();
                resolve(true); 
            }
        };

        client.subscribe(responseTopic, (err) => {
            if (err) return resolve(false);
            client.on('message', messageHandler);
            client.publish(checkTopic, 'PING');
            timeoutHandle = setTimeout(() => {
                cleanup();
                resolve(false); 
            }, 4000);
        });
    });
};

const sendCommand = (deviceId, command) => {
    if (!client.connected) return false;
    const topic = `cat/feeder/${deviceId}/command`;
    client.publish(topic, command);
    return true;
};

module.exports = { client, sendCommand, checkDeviceOnline };