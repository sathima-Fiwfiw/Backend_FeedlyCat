const express = require('express');
const router = express.Router();

// Import Controller 
const authController = require('../controllers/authController');

// --- User ---
router.post('/register', authController.register);// POST: http://localhost:3000/api/register
router.post('/login', authController.login);//http://localhost:3000/api/login

module.exports = router;