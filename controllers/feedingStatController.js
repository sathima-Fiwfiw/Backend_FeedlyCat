const db = require('../config/db');


// สรุปปริมาณอาหารที่แมวกิน  วัน / สัปดาห์ / เดือน / ปี
// GET /api/feeding-stats/:cat_id?filter=วัน|สัปดาห์|เดือน|ปี
exports.getFeedingStats = (req, res) => {
    const { cat_id } = req.params;
    const filter = req.query.filter || 'ปี';

    if (!cat_id) {
        return res.status(400).json({ message: "ไม่พบ cat_id" });
    }

    let sql;
    let labels; // แกน X ที่จะโชว์บนกราฟ (เตรียมไว้ล่วงหน้า เผื่อเดือน/วันไหนไม่มีข้อมูลจะได้เป็น 0)
    let groupKeyFn; // ใช้แปลงผลลัพธ์จาก DB (key ตัวเลข) ให้ตรงกับตำแหน่งใน labels

    switch (filter) {
        case 'วัน':
            // แยกตามชั่วโมงของ "วันนี้" (0-23)
            sql = `
                SELECT HOUR(time) AS unit, SUM(food) AS total
                FROM feeding_logs
                WHERE cat_id = ? AND DATE(time) = CURDATE() AND status = 'Completed'
                GROUP BY HOUR(time)
            `;
            labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            groupKeyFn = (unit) => unit; // 0-23 ตรงกับ index อยู่แล้ว
            break;

        case 'สัปดาห์':
            // แยกตามวันของ "สัปดาห์นี้" (จันทร์ - อาทิตย์)
            sql = `
                SELECT DAYOFWEEK(time) AS unit, SUM(food) AS total
                FROM feeding_logs
                WHERE cat_id = ? AND YEARWEEK(time, 1) = YEARWEEK(CURDATE(), 1) AND status = 'Completed'
                GROUP BY DAYOFWEEK(time)
            `;
            labels = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
            // MySQL DAYOFWEEK: 1=อาทิตย์, 2=จันทร์ ... 7=เสาร์ -> แปลงให้ตรงกับ labels (index 0 = จันทร์)
            groupKeyFn = (unit) => (unit === 1 ? 6 : unit - 2);
            break;

        case 'เดือน':
            // แยกตามวันของ "เดือนนี้" (1-31)
            sql = `
                SELECT DAY(time) AS unit, SUM(food) AS total
                FROM feeding_logs
                WHERE cat_id = ? AND YEAR(time) = YEAR(CURDATE()) AND MONTH(time) = MONTH(CURDATE()) AND status = 'Completed'
                GROUP BY DAY(time)
            `;
            {
                const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
                labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
            }
            groupKeyFn = (unit) => unit - 1; // วันที่ 1 -> index 0
            break;

        case 'ปี':
        default:
            // แยกตามเดือนของ "ปีนี้" (ม.ค. - ธ.ค.)
            sql = `
                SELECT MONTH(time) AS unit, SUM(food) AS total
                FROM feeding_logs
                WHERE cat_id = ? AND YEAR(time) = YEAR(CURDATE()) AND status = 'Completed'
                GROUP BY MONTH(time)
            `;
            labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            groupKeyFn = (unit) => unit - 1; // เดือน 1 (ม.ค.) -> index 0
            break;
    }

    db.query(sql, [cat_id], (err, results) => {
        if (err) {
            console.error("❌ Database Error (getFeedingStats):", err);
            return res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ" });
        }

        // เตรียม array ค่าเริ่มต้นเป็น 0 ตามจำนวน labels ทั้งหมด
        const values = new Array(labels.length).fill(0);

        results.forEach((row) => {
            const idx = groupKeyFn(row.unit);
            if (idx >= 0 && idx < values.length) {
                values[idx] = Number(row.total) || 0;
            }
        });

        console.log(`📊 [Feeding Stats] cat_id=${cat_id} filter=${filter} -> ${JSON.stringify(values)}`);

        res.json({
            cat_id: Number(cat_id),
            filter,
            labels,
            values,
        });
    });
};