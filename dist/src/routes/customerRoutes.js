const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/', authenticate, customerController.getCustomers);
router.get('/:id/ledger', authenticate, customerController.getCustomerLedger);
router.post('/', authenticate, customerController.createCustomer);
router.post('/:id/payments', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.SALES_STAFF), customerController.recordCustomerPayment);

module.exports = router;
