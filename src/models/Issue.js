const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
    issueId: {
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
        enum: ['open', 'closed'],
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
    milestone: {
        title: String,
        description: String,
        state: String,
        dueOn: Date
    },
    comments: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound unique index
issueSchema.index({ repositoryId: 1, issueId: 1 }, { unique: true });
issueSchema.index({ repositoryId: 1, state: 1 });

module.exports = mongoose.model('Issue', issueSchema); 