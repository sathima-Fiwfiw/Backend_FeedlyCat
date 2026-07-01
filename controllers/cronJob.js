// ใน cronJob.js ตรงจังหวะที่ส่ง MQTT
results.forEach(schedule => {
    const deviceId = schedule.device_id;
    const amount = schedule.portion; // ดึงปริมาณที่ตั้งไว้ในฐานข้อมูล
    
    console.log(`✅ [CRON] ถึงเวลาให้อาหาร! สั่งเครื่อง: ${deviceId} จำนวน ${amount} กรัม`);
    
    sendCommand(deviceId, `FEED_${amount}`); // จะได้ข้อความเช่น FEED_60
});