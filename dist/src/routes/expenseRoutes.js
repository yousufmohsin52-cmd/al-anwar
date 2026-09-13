const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { ROLES } = require('../config/constants');

router.get('/', authenticate, expenseController.getExpenses);
router.post('/', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), upload.single('receipt'), expenseController.createExpense);
router.delete('/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), expenseController.deleteExpense);

module.exports = router;
