const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const saleRoutes = require('./saleRoutes');
const purchaseRoutes = require('./purchaseRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const expenseRoutes = require('./expenseRoutes');
const customerRoutes = require('./customerRoutes');
const supplierRoutes = require('./supplierRoutes');
const returnRoutes = require('./returnRoutes');
const reconciliationRoutes = require('./reconciliationRoutes');
const reportRoutes = require('./reportRoutes');
const cmsRoutes = require('./cmsRoutes');
const ocrRoutes = require('./ocrRoutes');

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/sales', saleRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/expenses', expenseRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/returns', returnRoutes);
router.use('/reconciliation', reconciliationRoutes);
router.use('/reports', reportRoutes);
router.use('/cms', cmsRoutes);
router.use('/ocr', ocrRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'AL ANWAR FABRICS & CLOTH - API Engine',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
