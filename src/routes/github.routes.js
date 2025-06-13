const express = require('express');
const passport = require('passport');
const router = express.Router();
const githubController = require('../controllers/github.controller');

// OAuth routes
router.get('/auth', passport.authenticate('github', { scope: ['user', 'repo', 'read:org'] }));
router.get('/auth/callback', passport.authenticate('github', { session: false }), githubController.handleOAuthCallback);

// Integration management routes
router.get('/integration/:id/status', githubController.getIntegrationStatus);
router.delete('/integration/:id', githubController.removeIntegration);
router.post('/integration/:id/sync', githubController.syncGitHubData);
router.get('/integration/:id/data', githubController.getGitHubData);

module.exports = router; 