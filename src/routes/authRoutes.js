const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.post('/login', authController.login);
router.get('/me', authenticate, authController.getMe);
router.get('/users', authenticate, authorize(ROLES.SUPER_ADMIN), authController.listUsers);
router.post('/users', authenticate, authorize(ROLES.SUPER_ADMIN), authController.createUser);
router.put('/users/:id', authenticate, authorize(ROLES.SUPER_ADMIN), authController.updateUser);

module.exports = router;
