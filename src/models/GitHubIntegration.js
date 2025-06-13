const mongoose = require('mongoose');

const githubIntegrationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    githubId: {
        type: String,
        required: true,
        unique: true
    },
    accessToken: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    email: String,
    avatarUrl: String,
    connectedAt: {
        type: Date,
        default: Date.now
    },
    lastSynced: {
        type: Date,
        default: Date.now
    },
    organizations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization'
    }]
}, {
    collection: 'github-integration'
});

module.exports = mongoose.model('GitHubIntegration', githubIntegrationSchema); 