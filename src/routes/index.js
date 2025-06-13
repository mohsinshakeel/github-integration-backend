const express = require('express');
const router = express.Router();

// Import route modules
const githubRoutes = require('./github.routes');

// Define routes
router.use('/github', githubRoutes);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is healthy'
    });
});

module.exports = router; 