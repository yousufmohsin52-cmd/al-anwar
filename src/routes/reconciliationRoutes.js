const express = require('express');
const router = express.Router();
const reconciliationController = require('../controllers/reconciliationController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/', authenticate, reconciliationController.getReconciliationSummary);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), reconciliationController.saveReconciliation);

module.exports = router;
