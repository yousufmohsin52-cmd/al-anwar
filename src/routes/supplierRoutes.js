const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/', authenticate, supplierController.getSuppliers);
router.get('/:id/ledger', authenticate, supplierController.getSupplierLedger);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INVENTORY_MANAGER), supplierController.createSupplier);
router.post('/:id/payments', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), supplierController.recordSupplierPayment);

module.exports = router;
