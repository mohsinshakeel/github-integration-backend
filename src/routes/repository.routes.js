const express = require('express');
const router = express.Router();
const repositoryController = require('../controllers/repository.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// List repositories with filters and pagination
router.get('/integration/:id/repositories', repositoryController.listRepositories);

// Get single repository details
router.get('/integration/:id/repository/:repoId', repositoryController.getRepositoryDetails);

// Get repository statistics
router.get('/integration/:id/repository/:repoId/stats', repositoryController.getRepositoryStats);

// Sync repository data
router.post('/integration/:id/repository/:repoId/sync', repositoryController.syncRepository);

module.exports = router;
