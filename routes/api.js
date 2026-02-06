const express = require('express');
const router = express.Router();
const multer = require('multer');

// 1. เรียกใช้ Library ของ Cloudinary
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Import Controller
const authController = require('../controllers/authController');

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
router.post('/update-profile', upload.single('image'), authController.updateProfile);

module.exports = router;