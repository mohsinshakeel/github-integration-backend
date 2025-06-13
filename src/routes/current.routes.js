const express = require('express');
const router = express.Router();
const currentController = require('../controllers/current.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Initialize integration (create and sync in one call)
router.post('/integration/current/initialize', currentController.initializeIntegration);

// Current integration routes
router.get('/integration/current', currentController.getCurrentIntegration);
router.post('/integration/current', currentController.createCurrentIntegration);
router.post('/integration/current/sync', currentController.syncCurrentIntegration);

// Current integration data
router.get('/integration/current/repositories', currentController.getCurrentRepositories);
router.get('/integration/current/organizations', currentController.getCurrentOrganizations);

// Individual repository sync
router.post('/integration/current/repository/:id/sync', currentController.syncCurrentRepository);

module.exports = router; 