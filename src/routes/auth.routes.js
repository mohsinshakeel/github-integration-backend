const express = require('express');
const passport = require('passport');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const config = require('../config');
const GitHubIntegration = require('../models/GitHubIntegration');
const currentController = require('../controllers/current.controller');

// GitHub OAuth login
router.get('/github',
    passport.authenticate('github', { scope: ['user:email', 'read:org', 'repo'] })
);

// GitHub OAuth callback
router.get('/callback',
    passport.authenticate('github', { failureRedirect: `${config.cors.origin}/login?error=true` }),
    async (req, res) => {
        try {
            const { accessToken, profile } = req.user;
            
            console.log('GitHub profile:', profile);
            
            // Check if integration already exists for this GitHub user
            let integration = await GitHubIntegration.findOne({ githubId: profile.id });
            let isNewIntegration = false;
            
            if (!integration) {
                // Create new integration with GitHub profile data
                integration = new GitHubIntegration({
                    userId: `user_${Date.now()}`,
                    githubId: profile.id,
                    accessToken,
                    username: profile.username,
                    email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
                    avatarUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                    organizations: [],
                    lastSynced: null
                });
                await integration.save();
                console.log('Created new integration:', integration._id);
                isNewIntegration = true;
            } else {
                // Update existing integration with new access token
                integration.accessToken = accessToken;
                integration.email = profile.emails && profile.emails[0] ? profile.emails[0].value : integration.email;
                integration.avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : integration.avatarUrl;
                await integration.save();
                console.log('Updated existing integration:', integration._id);
            }
            
            // Auto-sync integration to fetch repositories immediately
            console.log('🔄 Auto-syncing integration to fetch repositories...');
            try {
                // Create a mock request object for the sync function
                const mockReq = {
                    accessToken: accessToken
                };
                
                // Create a proper mock response object with all needed methods
                const mockRes = {
                    status: function(code) {
                        this.statusCode = code;
                        return this; // Enable chaining
                    },
                    json: function(data) {
                        console.log('✅ Auto-sync completed:', {
                            organizations: data.data?.organizations?.length || 0,
                            totalRepositories: data.data?.totalRepositories || 0,
                            status: this.statusCode || 200
                        });
                        return this;
                    },
                    send: function(data) {
                        console.log('✅ Auto-sync response:', data);
                        return this;
                    }
                };
                
                const mockNext = (error) => {
                    if (error) {
                        console.error('❌ Auto-sync failed:', error.message);
                    }
                };
                
                // Run the sync
                await currentController.initializeIntegration(mockReq, mockRes, mockNext);
                
            } catch (syncError) {
                console.error('❌ Auto-sync error:', syncError.message);
                // Don't fail the entire OAuth flow if sync fails
            }
            
            // Redirect to Angular frontend with the token
            res.redirect(`${config.cors.origin}/auth/callback?token=${accessToken}&integrationId=${integration._id}&synced=true`);
        } catch (error) {
            console.error('Error in OAuth callback:', error);
            res.redirect(`${config.cors.origin}/login?error=true`);
        }
    }
);

// Get current user profile
router.get('/profile',
    authenticate,
    (req, res) => {
        res.json({
            success: true,
            data: req.user
        });
    }
);

// Logout
router.post('/logout',
    authenticate,
    (req, res) => {
        req.logout();
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
);

module.exports = router; 