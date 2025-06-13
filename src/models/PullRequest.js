const mongoose = require('mongoose');

const pullRequestSchema = new mongoose.Schema({
    prId: {
        type: Number,
        required: true
    },
    repositoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository',
        required: true
    },
    number: {
        type: Number,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    body: String,
    state: {
        type: String,
        enum: ['open', 'closed', 'merged'],
        required: true
    },
    user: {
        login: String,
        avatarUrl: String,
        url: String
    },
    createdAt: {
        type: Date,
        required: true
    },
    updatedAt: Date,
    closedAt: Date,
    mergedAt: Date,
    mergeable: Boolean,
    merged: Boolean,
    url: String,
    htmlUrl: String,
    labels: [{
        name: String,
        color: String,
        description: String
    }],
    assignees: [{
        login: String,
        avatarUrl: String
    }],
    requestedReviewers: [{
        login: String,
        avatarUrl: String
    }]
}, {
    timestamps: true
});

// Compound unique index
pullRequestSchema.index({ repositoryId: 1, prId: 1 }, { unique: true });
pullRequestSchema.index({ repositoryId: 1, state: 1 });

module.exports = mongoose.model('PullRequest', pullRequestSchema); 