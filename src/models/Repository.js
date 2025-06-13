const mongoose = require('mongoose');

const repositorySchema = new mongoose.Schema({
    repoId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: false
    },
    description: String,
    private: Boolean,
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    stats: {
        commits: Number,
        pulls: Number,
        issues: Number,
        stars: Number,
        forks: Number
    },
    lastSynced: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Repository', repositorySchema); 