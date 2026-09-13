const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { ROLES } = require('../config/constants');

// Public
router.get('/', productController.getPublicProducts);
router.get('/:id', productController.getProductById);

// Admin
router.get('/admin/all', authenticate, productController.getAdminProducts);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INVENTORY_MANAGER, ROLES.SALES_STAFF), upload.single('image'), productController.createProduct);
router.put('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INVENTORY_MANAGER, ROLES.SALES_STAFF), upload.single('image'), productController.updateProduct);
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.INVENTORY_MANAGER, ROLES.SALES_STAFF), productController.archiveProduct);
router.post('/upload', authenticate, upload.single('image'), productController.uploadProductImage);

module.exports = router;
