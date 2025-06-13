const Repository = require('../models/Repository');
const GitHubService = require('../services/github.service');
const GitHubIntegration = require('../models/GitHubIntegration');
const { AppError } = require('../middleware/errorHandler');

// Get repository details
exports.getRepositoryDetails = async (req, res, next) => {
    try {
        const { id, repoId } = req.params;
        
        const repository = await Repository.findOne({ 
            repoId,
            organizationId: { $in: (await GitHubIntegration.findById(id)).organizations }
        }).populate('organizationId');

        if (!repository) {
            return next(new AppError('Repository not found', 404));
        }

        res.status(200).json({
            success: true,
            data: repository
        });
    } catch (error) {
        next(error);
    }
};

// Get repository stats
exports.getRepositoryStats = async (req, res, next) => {
    try {
        const { id, repoId } = req.params;
        
        const repository = await Repository.findOne({ 
            repoId,
            organizationId: { $in: (await GitHubIntegration.findById(id)).organizations }
        });

        if (!repository) {
            return next(new AppError('Repository not found', 404));
        }

        res.status(200).json({
            success: true,
            data: repository.stats
        });
    } catch (error) {
        next(error);
    }
};

// Sync single repository
exports.syncRepository = async (req, res, next) => {
    try {
        const { id, repoId } = req.params;
        
        const integration = await GitHubIntegration.findById(id);
        if (!integration) {
            return next(new AppError('Integration not found', 404));
        }

        const repository = await Repository.findOne({ 
            repoId,
            organizationId: { $in: integration.organizations }
        }).populate('organizationId');

        if (!repository) {
            return next(new AppError('Repository not found', 404));
        }

        const github = new GitHubService(integration.accessToken);
        
        // Fetch latest repository data
        const [commits, pulls, issues, changelogs] = await Promise.all([
            github.getCommits(repository.organizationId.name, repository.name),
            github.getPulls(repository.organizationId.name, repository.name),
            github.getIssues(repository.organizationId.name, repository.name),
            github.getChangelogs(repository.organizationId.name, repository.name)
        ]);

        // Update repository stats
        repository.stats = {
            commits: commits.length,
            pulls: pulls.length,
            issues: issues.length,
            stars: repository.stats.stars,
            forks: repository.stats.forks
        };
        repository.lastSynced = new Date();
        await repository.save();

        res.status(200).json({
            success: true,
            data: repository
        });
    } catch (error) {
        next(error);
    }
};

// List repositories with filters
exports.listRepositories = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { 
            page = 1, 
            limit = 10, 
            search,
            sortBy = 'name',
            sortOrder = 'asc',
            minStars,
            minForks,
            minIssues
        } = req.query;

        const integration = await GitHubIntegration.findById(id);
        if (!integration) {
            return next(new AppError('Integration not found', 404));
        }

        let query = {
            organizationId: { $in: integration.organizations }
        };

        // Apply search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Apply numeric filters
        if (minStars) query['stats.stars'] = { $gte: parseInt(minStars) };
        if (minForks) query['stats.forks'] = { $gte: parseInt(minForks) };
        if (minIssues) query['stats.issues'] = { $gte: parseInt(minIssues) };

        // Execute query with pagination and sorting
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [repositories, total] = await Promise.all([
            Repository.find(query)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .populate('organizationId', 'name'),
            Repository.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: repositories,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        next(error);
    }
}; 