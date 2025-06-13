const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integration.controller');
const { authenticate } = require('../middleware/auth');

// Test endpoint (no auth required)
router.get('/integrations/test', integrationController.getAllIntegrationsTest);

// Debug endpoint (no auth required for debugging)
router.get('/repository/:repoId/debug', integrationController.debugRepositoryStats);

// All other routes require authentication
router.use(authenticate);

// Integration management
router.post('/integration', integrationController.createIntegration);
router.get('/integrations', integrationController.getIntegrations);
router.get('/integration/:id', integrationController.getIntegration);
router.post('/integration/:id/sync', integrationController.syncIntegration);
router.delete('/integration/:id', integrationController.deleteIntegration);

// Delete integration by GitHub ID
router.delete('/integration/github/:githubId', integrationController.deleteIntegrationByGithubId);

// Test GitHub API for debugging
router.get('/integration/:id/test-api', integrationController.testGitHubAPI);

// Get integration data (organizations, repositories, etc.)
router.get('/integration/:id/data', integrationController.getIntegrationData);

// Get Total no of collections
router.get('/integration/collections/list', integrationController.getGithubCollections);


module.exports = router; 