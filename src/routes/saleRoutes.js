const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/', authenticate, saleController.getSales);
router.get('/:id', authenticate, saleController.getSaleById);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.SALES_STAFF), saleController.createSale);
router.put('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.SALES_STAFF), saleController.updateSale);
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), saleController.deleteSale);
router.post('/:id/cancel', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), saleController.cancelSale);

module.exports = router;
