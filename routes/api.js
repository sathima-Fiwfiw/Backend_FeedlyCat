const express = require('express');
const router = express.Router();
const multer = require('multer');

// 1. เรียกใช้ Library ของ Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Import Controller
const authController = require('../controllers/authController');
const devicesController = require('../controllers/devicesController');
const catController = require('../controllers/catController');

// Cloudinary
cloudinary.config({
    cloud_name: 'dhxoc5hkd',
    api_key: '593483354845631',
    api_secret: 'jI5h8VrEfT6vmrRHQKLSnyoj-Nc'
});

// 3. กำหนดว่าจะเก็บไฟล์ยังไง
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'feedlycat_users', // ชื่อโฟลเดอร์ที่จะไปโผล่ใน Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg'], // นามสกุลที่ยอมรับ
    },
});

const upload = multer({ storage: storage });


// --- Routes ---

router.post('/register', upload.single('image'), authController.register);// POST: http://localhost:3000/api/register
router.post('/login', authController.login);//http://localhost:3000/api/login
router.post('/update-profile', upload.single('image'), authController.updateProfile);// อัพเดทรูปโปรไฟล์ + ข้อมูลอื่นๆ
router.post('/forgot-password', authController.forgotPassword);// ส่ง OTP
router.post('/reset-password', authController.resetPassword);// ตั้งรหัสผ่านใหม่
router.post('/change-password', authController.changePassword);// เปลี่ยนรหัสผ่าน (ต้องล็อกอินอยู่แล้ว)
router.post('/add-device', devicesController.addDevice);// เพิ่มอุปกรณ์ใหม่
router.get('/devices/:user_id', devicesController.getDevices); // เส้นนี้ใช้ดึงข้อมูลมาโชว์
router.post('/add-cat', catController.addCat);// เพิ่มข้อมูลแมว

module.exports = router;