const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { ROLES } = require('../config/constants');

// Public
router.get('/public', cmsController.getPublicCMS);

// Admin
router.get('/announcements', authenticate, cmsController.getAnnouncements);
router.post('/announcements', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), cmsController.updateAnnouncements);

router.get('/hero-slides', authenticate, cmsController.getHeroSlides);
router.post('/hero-slides', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), upload.single('image'), cmsController.createHeroSlide);
router.put('/hero-slides/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), upload.single('image'), cmsController.updateHeroSlide);
router.delete('/hero-slides/:id', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), cmsController.deleteHeroSlide);

router.post('/settings', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), cmsController.updateStoreSettings);
router.get('/audit-logs', authenticate, authorize(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT), cmsController.getAuditLogs);

module.exports = router;
