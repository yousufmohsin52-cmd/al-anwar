const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/dashboard', authenticate, reportController.getDashboardStats);
router.get('/download', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), reportController.getFinancialReport);

module.exports = router;
