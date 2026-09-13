const express = require('express');
const router = express.Router();
const ocrController = require('../controllers/ocrController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/parse-bill', authenticate, upload.single('billImage'), ocrController.parseBillImage);

module.exports = router;
