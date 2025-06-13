const GitHubIntegration = require("../models/GitHubIntegration");
const mongoose = require('mongoose');
const Organization = require("../models/Organization");
const Repository = require("../models/Repository");
const Commit = require("../models/Commit");
const PullRequest = require("../models/PullRequest");
const Issue = require("../models/Issue");
const Release = require("../models/Release");
const GitHubService = require("../services/github.service");
const { AppError } = require("../middleware/errorHandler");

exports.getGithubCollections = async (req, res) => {
  try {
    // switch to github database
    const db = mongoose.connection.useDb("test");

    // get all collection names
    const collections = await db.db.listCollections().toArray();
    const names = collections.map((c) => c.name);

    res.json({ success: true, collections: names });
  } catch (err) {
    console.error("Error fetching collections:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch collections" });
  }
};

// Create new integration
exports.createIntegration = async (req, res, next) => {
  try {
    const accessToken = req.accessToken;

    if (!accessToken) {
      return next(new AppError("Access token required", 401));
    }

    // Check if integration already exists for this token
    const existingIntegration = await GitHubIntegration.findOne({
      accessToken,
    });
    if (existingIntegration) {
      return res.status(200).json({
        success: true,
        data: existingIntegration,
      });
    }

    // Create new integration
    const integration = new GitHubIntegration({
      accessToken,
      userId: `user_${Date.now()}`, // In real app, get from authenticated user
      organizations: [],
      lastSynced: null,
    });

    await integration.save();

    res.status(201).json({
      success: true,
      data: integration,
    });
  } catch (error) {
    next(error);
  }
};

// Get all integrations
exports.getIntegrations = async (req, res, next) => {
  try {
    const integrations = await GitHubIntegration.find()
      .populate("organizations")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: integrations,
    });
  } catch (error) {
    next(error);
  }
};

// Get single integration
exports.getIntegration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const integration = await GitHubIntegration.findById(id).populate(
      "organizations"
    );

    if (!integration) {
      return next(new AppError("Integration not found", 404));
    }

    res.status(200).json({
      success: true,
      data: integration,
    });
  } catch (error) {
    next(error);
  }
};

// Sync integration data
exports.syncIntegration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const integration = await GitHubIntegration.findById(id);
    if (!integration) {
      return next(new AppError("Integration not found", 404));
    }

    const github = new GitHubService(integration.accessToken);

    console.log(
      "Starting comprehensive sync for integration:",
      integration.username
    );

    // Get user info first
    const userInfo = await github.getUser();
    console.log(`Syncing for user: ${userInfo.login}`);

    // Fetch organizations
    const orgsData = await github.getOrganizations();
    const organizationIds = [];

    // Create a virtual organization for user repositories
    let userOrganization = await Organization.findOne({ orgId: userInfo.id });
    if (!userOrganization) {
      userOrganization = new Organization({
        orgId: userInfo.id,
        name: userInfo.login,
        description:
          userInfo.bio || `Personal repositories for ${userInfo.login}`,
        avatarUrl: userInfo.avatar_url,
        publicRepos: userInfo.public_repos,
        publicGists: userInfo.public_gists,
        followers: userInfo.followers,
        following: userInfo.following,
      });
    } else {
      userOrganization.name = userInfo.login;
      userOrganization.description =
        userInfo.bio || `Personal repositories for ${userInfo.login}`;
      userOrganization.avatarUrl = userInfo.avatar_url;
      userOrganization.publicRepos = userInfo.public_repos;
      userOrganization.publicGists = userInfo.public_gists;
      userOrganization.followers = userInfo.followers;
      userOrganization.following = userInfo.following;
      userOrganization.lastSynced = new Date();
    }
    await userOrganization.save();
    organizationIds.push(userOrganization._id);

    // Sync user repositories
    console.log(`Syncing personal repositories for ${userInfo.login}`);
    const userRepos = await github.getUserRepositories();
    console.log(`Found ${userRepos.length} personal repositories`);

    for (const repoData of userRepos) {
      await syncRepositoryData(
        github,
        repoData,
        userOrganization._id,
        userInfo.login
      );
    }

    // Sync organization repositories
    for (const orgData of orgsData) {
      console.log(`Syncing organization: ${orgData.login}`);

      // Save or update organization
      let organization = await Organization.findOne({ orgId: orgData.id });

      if (!organization) {
        organization = new Organization({
          orgId: orgData.id,
          name: orgData.login,
          description: orgData.description,
          avatarUrl: orgData.avatar_url,
          publicRepos: orgData.public_repos,
          publicGists: orgData.public_gists,
          followers: orgData.followers,
          following: orgData.following,
        });
      } else {
        // Update existing organization
        organization.name = orgData.login;
        organization.description = orgData.description;
        organization.avatarUrl = orgData.avatar_url;
        organization.publicRepos = orgData.public_repos;
        organization.publicGists = orgData.public_gists;
        organization.followers = orgData.followers;
        organization.following = orgData.following;
        organization.lastSynced = new Date();
      }

      await organization.save();
      organizationIds.push(organization._id);

      // Fetch repositories for this organization
      const reposData = await github.getRepositories(orgData.login);
      console.log(`Found ${reposData.length} repositories in ${orgData.login}`);

      for (const repoData of reposData) {
        await syncRepositoryData(
          github,
          repoData,
          organization._id,
          orgData.login
        );
      }
    }

    // Update integration
    integration.organizations = organizationIds;
    integration.lastSynced = new Date();
    await integration.save();

    console.log("✓ Comprehensive sync completed successfully");

    // Return updated integration
    const updatedIntegration = await GitHubIntegration.findById(id).populate(
      "organizations"
    );

    res.status(200).json({
      success: true,
      message: "Integration synced with full GitHub data",
      data: updatedIntegration,
    });
  } catch (error) {
    console.error("Sync error:", error);
    next(error);
  }
};

// Helper function to sync repository data
async function syncRepositoryData(github, repoData, organizationId, ownerName) {
  console.log(`Syncing repository: ${repoData.full_name}`);

  let repository = await Repository.findOne({ repoId: repoData.id });

  if (!repository) {
    repository = new Repository({
      repoId: repoData.id,
      name: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description,
      private: repoData.private,
      organizationId: organizationId,
      stats: {
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        issues: 0, // Will be updated below
        pulls: 0, // Will be updated below
        commits: 0, // Will be updated below
      },
    });
  } else {
    // Update existing repository
    repository.name = repoData.name;
    repository.fullName = repoData.full_name;
    repository.description = repoData.description;
    repository.private = repoData.private;
    repository.stats.stars = repoData.stargazers_count;
    repository.stats.forks = repoData.forks_count;
    repository.lastSynced = new Date();
  }

  await repository.save();

  // Now fetch detailed data for this repository
  try {
    console.log(`  Fetching commits for ${repoData.full_name}...`);
    const commits = await github.getCommits(ownerName, repoData.name);

    // Save commits
    for (const commitData of commits.slice(0, 100)) {
      // Limit to last 100 commits
      await Commit.findOneAndUpdate(
        { sha: commitData.sha },
        {
          sha: commitData.sha,
          repositoryId: repository._id,
          message: commitData.commit.message,
          author: {
            name: commitData.commit.author.name,
            email: commitData.commit.author.email,
            login: commitData.author?.login,
            avatarUrl: commitData.author?.avatar_url,
          },
          committer: {
            name: commitData.commit.committer.name,
            email: commitData.commit.committer.email,
            login: commitData.committer?.login,
            avatarUrl: commitData.committer?.avatar_url,
          },
          date: new Date(commitData.commit.author.date),
          url: commitData.html_url,
        },
        { upsert: true, new: true }
      );
    }

    repository.stats.commits = commits.length;
    console.log(`  Saved ${commits.length} commits`);
  } catch (commitError) {
    console.error(
      `Error fetching commits for ${repoData.full_name}:`,
      commitError.message
    );
  }

  try {
    console.log(`  Fetching pull requests for ${repoData.full_name}...`);
    const pulls = await github.getPulls(ownerName, repoData.name);

    // Save pull requests
    for (const pullData of pulls) {
      await PullRequest.findOneAndUpdate(
        { repositoryId: repository._id, prId: pullData.id },
        {
          prId: pullData.id,
          repositoryId: repository._id,
          number: pullData.number,
          title: pullData.title,
          body: pullData.body,
          state: pullData.merged ? "merged" : pullData.state,
          user: {
            login: pullData.user.login,
            avatarUrl: pullData.user.avatar_url,
            url: pullData.user.html_url,
          },
          createdAt: new Date(pullData.created_at),
          updatedAt: pullData.updated_at ? new Date(pullData.updated_at) : null,
          closedAt: pullData.closed_at ? new Date(pullData.closed_at) : null,
          mergedAt: pullData.merged_at ? new Date(pullData.merged_at) : null,
          mergeable: pullData.mergeable,
          merged: pullData.merged,
          url: pullData.url,
          htmlUrl: pullData.html_url,
        },
        { upsert: true, new: true }
      );
    }

    repository.stats.pulls = pulls.length;
    console.log(`  Saved ${pulls.length} pull requests`);
  } catch (pullError) {
    console.error(
      `Error fetching pulls for ${repoData.full_name}:`,
      pullError.message
    );
  }

  try {
    console.log(`  Fetching issues for ${repoData.full_name}...`);
    const issues = await github.getIssues(ownerName, repoData.name);

    // Filter out pull requests (GitHub API returns PRs as issues)
    const actualIssues = issues.filter((issue) => !issue.pull_request);

    // Save issues
    for (const issueData of actualIssues) {
      await Issue.findOneAndUpdate(
        { repositoryId: repository._id, issueId: issueData.id },
        {
          issueId: issueData.id,
          repositoryId: repository._id,
          number: issueData.number,
          title: issueData.title,
          body: issueData.body,
          state: issueData.state,
          user: {
            login: issueData.user.login,
            avatarUrl: issueData.user.avatar_url,
            url: issueData.user.html_url,
          },
          createdAt: new Date(issueData.created_at),
          updatedAt: issueData.updated_at
            ? new Date(issueData.updated_at)
            : null,
          closedAt: issueData.closed_at ? new Date(issueData.closed_at) : null,
          url: issueData.url,
          htmlUrl: issueData.html_url,
          comments: issueData.comments || 0,
        },
        { upsert: true, new: true }
      );
    }

    repository.stats.issues = actualIssues.length;
    console.log(`  Saved ${actualIssues.length} issues`);
  } catch (issueError) {
    console.error(
      `Error fetching issues for ${repoData.full_name}:`,
      issueError.message
    );
  }

  try {
    console.log(`  Fetching releases for ${repoData.full_name}...`);
    const releases = await github.getChangelogs(ownerName, repoData.name);

    // Save releases
    for (const releaseData of releases) {
      await Release.findOneAndUpdate(
        { repositoryId: repository._id, releaseId: releaseData.id },
        {
          releaseId: releaseData.id,
          repositoryId: repository._id,
          tagName: releaseData.tag_name,
          name: releaseData.name,
          body: releaseData.body,
          draft: releaseData.draft,
          prerelease: releaseData.prerelease,
          createdAt: new Date(releaseData.created_at),
          publishedAt: releaseData.published_at
            ? new Date(releaseData.published_at)
            : null,
          author: {
            login: releaseData.author?.login,
            avatarUrl: releaseData.author?.avatar_url,
            url: releaseData.author?.html_url,
          },
          url: releaseData.url,
          htmlUrl: releaseData.html_url,
          tarballUrl: releaseData.tarball_url,
          zipballUrl: releaseData.zipball_url,
        },
        { upsert: true, new: true }
      );
    }

    console.log(`  Saved ${releases.length} releases`);
  } catch (releaseError) {
    console.error(
      `Error fetching releases for ${repoData.full_name}:`,
      releaseError.message
    );
  }

  // Update repository with final stats
  await repository.save();
  console.log(`✓ Completed syncing ${repoData.full_name}`);
}

// Get integration data (generic endpoint for any collection)
exports.getIntegrationData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { collection } = req.query;
    const { page = 1, limit = 10, search } = req.query;

    const integration = await GitHubIntegration.findById(id);
    if (!integration) {
      return next(new AppError("Integration not found", 404));
    }

    let data = [];
    let total = 0;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    switch (collection) {
      case "organizations":
        const orgQuery = { _id: { $in: integration.organizations } };
        if (search) {
          orgQuery.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        data = await Organization.find(orgQuery)
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ name: 1 });
        total = await Organization.countDocuments(orgQuery);
        break;

      case "repositories":
        const repoQuery = {
          organizationId: { $in: integration.organizations },
        };
        if (search) {
          repoQuery.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        data = await Repository.find(repoQuery)
          .populate("organizationId", "name")
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ name: 1 });
        total = await Repository.countDocuments(repoQuery);
        break;

      case "commits":
        // Get all repositories for this integration
        const repositories = await Repository.find({
          organizationId: { $in: integration.organizations },
        });
        const repositoryIds = repositories.map((repo) => repo._id);

        const commitQuery = {
          repositoryId: { $in: repositoryIds },
        };
        if (search) {
          commitQuery.$or = [
            { message: { $regex: search, $options: "i" } },
            { "author.name": { $regex: search, $options: "i" } },
            { "author.login": { $regex: search, $options: "i" } },
          ];
        }

        data = await Commit.find(commitQuery)
          .populate("repositoryId", "name fullName")
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ date: -1 });
        total = await Commit.countDocuments(commitQuery);
        break;

      case "pulls":
        const pullRepositories = await Repository.find({
          organizationId: { $in: integration.organizations },
        });
        const pullRepositoryIds = pullRepositories.map((repo) => repo._id);

        const pullQuery = {
          repositoryId: { $in: pullRepositoryIds },
        };
        if (search) {
          pullQuery.$or = [
            { title: { $regex: search, $options: "i" } },
            { body: { $regex: search, $options: "i" } },
            { "user.login": { $regex: search, $options: "i" } },
          ];
        }

        data = await PullRequest.find(pullQuery)
          .populate("repositoryId", "name fullName")
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ createdAt: -1 });
        total = await PullRequest.countDocuments(pullQuery);
        break;

      case "issues":
        const issueRepositories = await Repository.find({
          organizationId: { $in: integration.organizations },
        });
        const issueRepositoryIds = issueRepositories.map((repo) => repo._id);

        const issueQuery = {
          repositoryId: { $in: issueRepositoryIds },
        };
        if (search) {
          issueQuery.$or = [
            { title: { $regex: search, $options: "i" } },
            { body: { $regex: search, $options: "i" } },
            { "user.login": { $regex: search, $options: "i" } },
          ];
        }

        data = await Issue.find(issueQuery)
          .populate("repositoryId", "name fullName")
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ createdAt: -1 });
        total = await Issue.countDocuments(issueQuery);
        break;

      case "releases":
        const releaseRepositories = await Repository.find({
          organizationId: { $in: integration.organizations },
        });
        const releaseRepositoryIds = releaseRepositories.map(
          (repo) => repo._id
        );

        const releaseQuery = {
          repositoryId: { $in: releaseRepositoryIds },
        };
        if (search) {
          releaseQuery.$or = [
            { name: { $regex: search, $options: "i" } },
            { tagName: { $regex: search, $options: "i" } },
            { body: { $regex: search, $options: "i" } },
          ];
        }

        data = await Release.find(releaseQuery)
          .populate("repositoryId", "name fullName")
          .skip(skip)
          .limit(parseInt(limit))
          .sort({ publishedAt: -1 });
        total = await Release.countDocuments(releaseQuery);
        break;

      default:
        return next(
          new AppError(
            "Invalid collection specified. Valid options: organizations, repositories, commits, pulls, issues, releases",
            400
          )
        );
    }

    res.status(200).json({
      success: true,
      collection,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete integration
exports.deleteIntegration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const integration = await GitHubIntegration.findById(id);
    if (!integration) {
      return next(new AppError("Integration not found", 404));
    }

    let deletedData = {
      integration: integration._id,
      organizations: [],
      repositories: [],
      commits: 0,
      pulls: 0,
      issues: 0,
      releases: 0,
    };

    // Find repositories associated with this integration's organizations
    const repositories = await Repository.find({
      organizationId: { $in: integration.organizations },
    });

    if (repositories.length > 0) {
      const repositoryIds = repositories.map((repo) => repo._id);

      // Delete detailed data for each repository
      const commitsDeleted = await Commit.deleteMany({
        repositoryId: { $in: repositoryIds },
      });
      const pullsDeleted = await PullRequest.deleteMany({
        repositoryId: { $in: repositoryIds },
      });
      const issuesDeleted = await Issue.deleteMany({
        repositoryId: { $in: repositoryIds },
      });
      const releasesDeleted = await Release.deleteMany({
        repositoryId: { $in: repositoryIds },
      });

      deletedData.commits = commitsDeleted.deletedCount;
      deletedData.pulls = pullsDeleted.deletedCount;
      deletedData.issues = issuesDeleted.deletedCount;
      deletedData.releases = releasesDeleted.deletedCount;

      // Delete repositories
      await Repository.deleteMany({ _id: { $in: repositoryIds } });
      deletedData.repositories = repositoryIds;
    }

    // Delete organizations associated with this integration
    if (integration.organizations.length > 0) {
      await Organization.deleteMany({
        _id: { $in: integration.organizations },
      });
      deletedData.organizations = integration.organizations;
    }

    // Delete the integration
    await GitHubIntegration.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Integration and all related data deleted successfully",
      data: deletedData,
    });
  } catch (error) {
    next(error);
  }
};

// Delete integration by GitHub ID
exports.deleteIntegrationByGithubId = async (req, res, next) => {
  try {
    const { githubId } = req.params;

    const integration = await GitHubIntegration.findOne({ githubId });
    if (!integration) {
      return next(new AppError("Integration not found", 404));
    }

    let deletedData = {
      integration: integration._id,
      githubId: integration.githubId,
      username: integration.username,
      organizations: [],
      repositories: [],
      commits: 0,
      pulls: 0,
      issues: 0,
      releases: 0,
    };

    // Find repositories associated with this integration's organizations
    const repositories = await Repository.find({
      organizationId: { $in: integration.organizations },
    });

    if (repositories.length > 0) {
      const repositoryIds = repositories.map((repo) => repo._id);

      // Delete detailed data for each repository
      const commitsDeleted = await Commit.deleteMany({
        repositoryId: { $in: repositoryIds },
      });
      const pullsDeleted = await PullRequest.deleteMany({
        repositoryId: { $in: repositoryIds },
      });
      const issuesDeleted = await Issue.deleteMany({
        repositoryId: { $in: repositoryIds },
      });
      const releasesDeleted = await Release.deleteMany({
        repositoryId: { $in: repositoryIds },
      });

      deletedData.commits = commitsDeleted.deletedCount;
      deletedData.pulls = pullsDeleted.deletedCount;
      deletedData.issues = issuesDeleted.deletedCount;
      deletedData.releases = releasesDeleted.deletedCount;

      // Delete repositories
      await Repository.deleteMany({ _id: { $in: repositoryIds } });
      deletedData.repositories = repositoryIds;
    }

    // Delete organizations associated with this integration
    if (integration.organizations.length > 0) {
      await Organization.deleteMany({
        _id: { $in: integration.organizations },
      });
      deletedData.organizations = integration.organizations;
    }

    // Delete the integration
    await GitHubIntegration.findByIdAndDelete(integration._id);

    res.status(200).json({
      success: true,
      message: "Integration and all related data deleted successfully",
      data: deletedData,
    });
  } catch (error) {
    next(error);
  }
};

// Test endpoint to get all integrations without auth (for debugging)
exports.getAllIntegrationsTest = async (req, res, next) => {
  try {
    const integrations = await GitHubIntegration.find(
      {},
      "githubId username _id"
    ).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: integrations.length,
      data: integrations,
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    next(error);
  }
};

// Test GitHub API endpoints for debugging
exports.testGitHubAPI = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { owner, repo } = req.query;

    if (!owner || !repo) {
      return next(new AppError("Owner and repo parameters are required", 400));
    }

    const integration = await GitHubIntegration.findById(id);
    if (!integration) {
      return next(new AppError("Integration not found", 404));
    }

    const github = new GitHubService(integration.accessToken);

    console.log(`Testing GitHub API for ${owner}/${repo}`);

    let testResults = {
      repository: `${owner}/${repo}`,
      tests: {},
    };

    // Test commits API
    try {
      console.log("Testing commits API...");
      const commits = await github.getCommits(owner, repo);
      testResults.tests.commits = {
        success: true,
        count: commits.length,
        sample: commits.slice(0, 2).map((c) => ({
          sha: c.sha,
          message: c.commit.message,
          author: c.commit.author.name,
          date: c.commit.author.date,
        })),
      };
      console.log(`✓ Commits API: ${commits.length} commits found`);
    } catch (error) {
      testResults.tests.commits = {
        success: false,
        error: error.message,
      };
      console.log(`✗ Commits API error: ${error.message}`);
    }

    // Test pulls API
    try {
      console.log("Testing pulls API...");
      const pulls = await github.getPulls(owner, repo);
      testResults.tests.pulls = {
        success: true,
        count: pulls.length,
        sample: pulls.slice(0, 2).map((p) => ({
          number: p.number,
          title: p.title,
          state: p.state,
          user: p.user.login,
        })),
      };
      console.log(`✓ Pulls API: ${pulls.length} pulls found`);
    } catch (error) {
      testResults.tests.pulls = {
        success: false,
        error: error.message,
      };
      console.log(`✗ Pulls API error: ${error.message}`);
    }

    // Test issues API
    try {
      console.log("Testing issues API...");
      const issues = await github.getIssues(owner, repo);
      const actualIssues = issues.filter((issue) => !issue.pull_request);
      testResults.tests.issues = {
        success: true,
        count: actualIssues.length,
        totalWithPRs: issues.length,
        sample: actualIssues.slice(0, 2).map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          user: i.user.login,
        })),
      };
      console.log(
        `✓ Issues API: ${actualIssues.length} issues found (${issues.length} total including PRs)`
      );
    } catch (error) {
      testResults.tests.issues = {
        success: false,
        error: error.message,
      };
      console.log(`✗ Issues API error: ${error.message}`);
    }

    // Test releases API
    try {
      console.log("Testing releases API...");
      const releases = await github.getChangelogs(owner, repo);
      testResults.tests.releases = {
        success: true,
        count: releases.length,
        sample: releases.slice(0, 2).map((r) => ({
          tagName: r.tag_name,
          name: r.name,
          draft: r.draft,
          prerelease: r.prerelease,
        })),
      };
      console.log(`✓ Releases API: ${releases.length} releases found`);
    } catch (error) {
      testResults.tests.releases = {
        success: false,
        error: error.message,
      };
      console.log(`✗ Releases API error: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      data: testResults,
    });
  } catch (error) {
    console.error("Test API error:", error);
    next(error);
  }
};

// Debug endpoint to check repository stats
exports.debugRepositoryStats = async (req, res, next) => {
  try {
    const { repoId } = req.params;

    const repository = await Repository.findOne({ repoId }).populate(
      "organizationId",
      "name"
    );
    if (!repository) {
      return next(new AppError("Repository not found", 404));
    }

    // Get detailed counts from database
    const commitsCount = await Commit.countDocuments({
      repositoryId: repository._id,
    });
    const pullsCount = await PullRequest.countDocuments({
      repositoryId: repository._id,
    });
    const issuesCount = await Issue.countDocuments({
      repositoryId: repository._id,
    });
    const releasesCount = await Release.countDocuments({
      repositoryId: repository._id,
    });

    const debugInfo = {
      repository: {
        _id: repository._id,
        repoId: repository.repoId,
        name: repository.name,
        fullName: repository.fullName,
        organization: repository.organizationId?.name,
      },
      statsFromModel: repository.stats,
      actualCountsInDB: {
        commits: commitsCount,
        pulls: pullsCount,
        issues: issuesCount,
        releases: releasesCount,
      },
      lastSynced: repository.lastSynced,
    };

    res.status(200).json({
      success: true,
      data: debugInfo,
    });
  } catch (error) {
    next(error);
  }
};
