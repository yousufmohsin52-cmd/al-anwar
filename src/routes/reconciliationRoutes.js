const express = require('express');
const router = express.Router();
const reconciliationController = require('../controllers/reconciliationController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/', authenticate, reconciliationController.getReconciliationSummary);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), reconciliationController.saveReconciliation);
router.get('/transactions', authenticate, reconciliationController.getBankTransactions);
router.post('/transaction', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), reconciliationController.recordBankTransaction);
router.delete('/transaction/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), reconciliationController.deleteBankTransaction);

module.exports = router;
