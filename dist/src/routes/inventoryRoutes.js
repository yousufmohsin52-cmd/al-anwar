const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/movements', authenticate, inventoryController.getMovements);
router.get('/valuation', authenticate, inventoryController.getValuation);
router.post('/adjustments', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.INVENTORY_MANAGER), inventoryController.createAdjustment);

module.exports = router;
