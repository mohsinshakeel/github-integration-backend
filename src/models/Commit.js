const mongoose = require('mongoose');

const commitSchema = new mongoose.Schema({
    sha: {
        type: String,
        required: true,
        unique: true
    },
    repositoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    author: {
        name: String,
        email: String,
        login: String,
        avatarUrl: String
    },
    committer: {
        name: String,
        email: String,
        login: String,
        avatarUrl: String
    },
    date: {
        type: Date,
        required: true
    },
    url: String,
    stats: {
        additions: Number,
        deletions: Number,
        total: Number
    }
}, {
    timestamps: true
});

// Index for efficient queries
commitSchema.index({ repositoryId: 1, date: -1 });
commitSchema.index({ sha: 1 });

module.exports = mongoose.model('Commit', commitSchema); 