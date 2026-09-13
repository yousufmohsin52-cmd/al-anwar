const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/', categoryController.getCategories);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INVENTORY_MANAGER), categoryController.createCategory);
router.put('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INVENTORY_MANAGER), categoryController.updateCategory);
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INVENTORY_MANAGER), categoryController.deleteCategory);

module.exports = router;
