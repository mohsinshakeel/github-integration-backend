const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
    orgId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    avatarUrl: String,
    repositories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository'
    }],
    lastSynced: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Organization', organizationSchema); 