const mongoose = require('mongoose');

const releaseSchema = new mongoose.Schema({
    releaseId: {
        type: Number,
        required: true
    },
    repositoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Repository',
        required: true
    },
    tagName: {
        type: String,
        required: true
    },
    name: String,
    body: String,
    draft: {
        type: Boolean,
        default: false
    },
    prerelease: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        required: true
    },
    publishedAt: Date,
    author: {
        login: String,
        avatarUrl: String,
        url: String
    },
    url: String,
    htmlUrl: String,
    assetsUrl: String,
    uploadUrl: String,
    tarballUrl: String,
    zipballUrl: String,
    assets: [{
        name: String,
        label: String,
        contentType: String,
        size: Number,
        downloadCount: Number,
        browserDownloadUrl: String
    }]
}, {
    timestamps: true
});

// Compound unique index
releaseSchema.index({ repositoryId: 1, releaseId: 1 }, { unique: true });
releaseSchema.index({ repositoryId: 1, publishedAt: -1 });

module.exports = mongoose.model('Release', releaseSchema); 