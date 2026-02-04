//ไฟล์นี้ทำหน้าที่เหมือน ป้ายบอกทาง ว่าถ้าเข้ามา URL นี้ ให้ไปเรียกฟังก์ชันไหนทำงาน

const express = require('express');
const router = express.Router();

// Import Controllers เข้ามา
const catController = require('../controllers/catController');
const authController = require('../controllers/authController');

// --- Routes เกี่ยวกับแมว ---
router.get('/cats', catController.getAllCats);
router.get('/logs', catController.getFeedingLogs);
router.post('/feed', catController.feedCat);

// --- Routes เกี่ยวกับ User ---
router.post('/register', authController.register);

module.exports = router;