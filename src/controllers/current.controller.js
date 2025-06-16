const GitHubIntegration = require("../models/GitHubIntegration");
const Organization = require("../models/Organization");
const Repository = require("../models/Repository");
const GitHubService = require("../services/github.service");
const { AppError } = require("../middleware/errorHandler");
const Commit = require("../models/Commit");
const PullRequest = require("../models/PullRequest");
const Issue = require("../models/Issue");
const Release = require("../models/Release");

// Get current integration (most recent one)
const getCurrentIntegration = async (accessToken) => {
  // First try to find by access token
  let integration = await GitHubIntegration.findOne({ accessToken }).populate(
    "organizations"
  );

  if (!integration) {
    // If not found, get the most recent integration
    integration = await GitHubIntegration.findOne()
      .sort({ createdAt: -1 })
      .populate("organizations");
  }

  return integration;
};

// Initialize integration (create and sync in one call)
exports.initializeIntegration = async (req, res, next) => {
  try {
    const accessToken = req.accessToken;

    if (!accessToken) {
      return next(new AppError("Access token required", 401));
    }

    // Find integration by access token
    let integration = await GitHubIntegration.findOne({ accessToken });

    if (!integration) {
      return next(
        new AppError(
          "Integration not found. Please complete OAuth flow first.",
          404
        )
      );
    }

    // Force fresh sync every time for debugging - remove the condition
    // if (!integration.lastSynced || integration.organizations.length === 0) {
    console.log("Syncing integration data...");

    const github = new GitHubService(integration.accessToken);
    const organizationIds = [];

    try {
      // First, get user info
      const userData = await github.getUser();
      console.log(
        "GitHub user:",
        userData.login,
        "Public repos:",
        userData.public_repos
      );

      // Create a "personal" organization for user's own repositories
      let userOrganization = await Organization.findOne({
        name: userData.login,
        orgId: userData.id,
      });

      if (!userOrganization) {
        console.log("Creating new user organization...");
        userOrganization = new Organization({
          orgId: userData.id,
          name: userData.login,
          description: `Personal repositories for ${userData.login}`,
          avatarUrl: userData.avatar_url,
          publicRepos: userData.public_repos,
          publicGists: userData.public_gists,
          followers: userData.followers,
          following: userData.following,
        });
      } else {
        console.log("Updating existing user organization...");
        // Update existing user organization
        userOrganization.description = `Personal repositories for ${userData.login}`;
        userOrganization.avatarUrl = userData.avatar_url;
        userOrganization.publicRepos = userData.public_repos;
        userOrganization.publicGists = userData.public_gists;
        userOrganization.followers = userData.followers;
        userOrganization.following = userData.following;
        userOrganization.lastSynced = new Date();
      }

      const savedUserOrg = await userOrganization.save();
      console.log("✅ User organization saved:", savedUserOrg._id);
      organizationIds.push(savedUserOrg._id);

      // Fetch user's personal repositories
      console.log("Fetching personal repositories...");
      try {
        const userReposData = await github.getUserRepositories();
        console.log(`Found ${userReposData.length} personal repositories`);

        // Count private vs public
        const publicCount = userReposData.filter(
          (repo) => !repo.private
        ).length;
        const privateCount = userReposData.filter(
          (repo) => repo.private
        ).length;
        console.log(`  - ${publicCount} public repositories`);
        console.log(`  - ${privateCount} private repositories`);

        for (const repoData of userReposData) {
          const repoType = repoData.private ? "PRIVATE" : "PUBLIC";
          console.log(`Processing repository: ${repoData.name} (${repoType})`);
          let repository = await Repository.findOne({ repoId: repoData.id });

          if (!repository) {
            console.log(
              `Creating new repository: ${repoData.name} (${repoType})`
            );
            repository = new Repository({
              repoId: repoData.id,
              name: repoData.name,
              fullName: repoData.full_name,
              description: repoData.description,
              private: repoData.private,
              organizationId: savedUserOrg._id,
              stats: {
                stars: repoData.stargazers_count,
                forks: repoData.forks_count,
                issues: 0,
                pulls: 0,
                commits: 0,
              },
            });
          } else {
            console.log(
              `Updating existing repository: ${repoData.name} (${repoType})`
            );
            // Update existing repository
            repository.name = repoData.name;
            repository.fullName = repoData.full_name;
            repository.description = repoData.description;
            repository.private = repoData.private;
            repository.organizationId = savedUserOrg._id; // Make sure it's under user org
            repository.stats.stars = repoData.stargazers_count;
            repository.stats.forks = repoData.forks_count;
            repository.lastSynced = new Date();
          }

          try {
            const savedRepo = await repository.save();
            console.log(
              `✅ Saved repository: ${savedRepo.name} (${repoType}) with ID: ${savedRepo._id}`
            );

            // Fetch and save repository data
            try {
              const [owner, repoName] = savedRepo.fullName.split('/');
              console.log(`Fetching data for ${savedRepo.fullName}...`);

              // Fetch and save commits
              console.log(`  Fetching commits...`);
              const commits = (await github.getCommits(owner, repoName)).slice(0, 10);
              console.log(`  Found ${commits.length} commits`);

              for (const commitData of commits) {
                await Commit.findOneAndUpdate(
                  { sha: commitData.sha },
                  {
                    sha: commitData.sha,
                    repositoryId: savedRepo._id,
                    message: commitData.commit.message,
                    author: {
                      name: commitData.commit.author.name,
                      email: commitData.commit.author.email,
                      login: commitData.author?.login,
                      avatarUrl: commitData.author?.avatar_url
                    },
                    committer: {
                      name: commitData.commit.committer.name,
                      email: commitData.commit.committer.email,
                      login: commitData.committer?.login,
                      avatarUrl: commitData.committer?.avatar_url
                    },
                    date: new Date(commitData.commit.author.date),
                    url: commitData.html_url,
                    stats: commitData.stats || { additions: 0, deletions: 0, total: 0 }
                  },
                  { upsert: true, new: true }
                );
              }
              console.log(`  ✅ Saved ${commits.length} commits`);

              // Fetch and save pull requests
              console.log(`  Fetching pull requests...`);
              const pulls = (await github.getPulls(owner, repoName)).slice(0, 10);
              console.log(`  Found ${pulls.length} pull requests`);

              for (const pullData of pulls) {
                await PullRequest.findOneAndUpdate(
                  { repositoryId: savedRepo._id, prId: pullData.id },
                  {
                    prId: pullData.id,
                    repositoryId: savedRepo._id,
                    number: pullData.number,
                    title: pullData.title,
                    body: pullData.body,
                    state: pullData.state,
                    user: {
                      login: pullData.user.login,
                      avatarUrl: pullData.user.avatar_url,
                      url: pullData.user.html_url
                    },
                    createdAt: new Date(pullData.created_at),
                    updatedAt: pullData.updated_at ? new Date(pullData.updated_at) : null,
                    closedAt: pullData.closed_at ? new Date(pullData.closed_at) : null,
                    mergedAt: pullData.merged_at ? new Date(pullData.merged_at) : null,
                    url: pullData.url,
                    htmlUrl: pullData.html_url,
                    labels: pullData.labels.map(label => ({
                      name: label.name,
                      color: label.color,
                      description: label.description
                    })),
                    assignees: pullData.assignees.map(assignee => ({
                      login: assignee.login,
                      avatarUrl: assignee.avatar_url
                    })),
                    requestedReviewers: pullData.requested_reviewers.map(reviewer => ({
                      login: reviewer.login,
                      avatarUrl: reviewer.avatar_url
                    }))
                  },
                  { upsert: true, new: true }
                );
              }
              console.log(`  ✅ Saved ${pulls.length} pull requests`);

              // Fetch and save issues
              console.log(`  Fetching issues...`);
              const issues = (await github.getIssues(owner, repoName)).slice(0, 10);
              console.log(`  Found ${issues.length} total issues`);

              // Filter out pull requests (GitHub API returns PRs as issues)
              const actualIssues = issues.filter(issue => !issue.pull_request);
              console.log(`  Filtered to ${actualIssues.length} actual issues (excluding PRs)`);

              for (const issueData of actualIssues) {
                await Issue.findOneAndUpdate(
                  { repositoryId: savedRepo._id, issueId: issueData.id },
                  {
                    issueId: issueData.id,
                    repositoryId: savedRepo._id,
                    number: issueData.number,
                    title: issueData.title,
                    body: issueData.body,
                    state: issueData.state,
                    user: {
                      login: issueData.user.login,
                      avatarUrl: issueData.user.avatar_url,
                      url: issueData.user.html_url
                    },
                    createdAt: new Date(issueData.created_at),
                    updatedAt: issueData.updated_at ? new Date(issueData.updated_at) : null,
                    closedAt: issueData.closed_at ? new Date(issueData.closed_at) : null,
                    url: issueData.url,
                    htmlUrl: issueData.html_url,
                    labels: issueData.labels.map(label => ({
                      name: label.name,
                      color: label.color,
                      description: label.description
                    })),
                    assignees: issueData.assignees.map(assignee => ({
                      login: assignee.login,
                      avatarUrl: assignee.avatar_url
                    })),
                    milestone: issueData.milestone ? {
                      title: issueData.milestone.title,
                      description: issueData.milestone.description,
                      state: issueData.milestone.state,
                      dueOn: issueData.milestone.due_on ? new Date(issueData.milestone.due_on) : null
                    } : null,
                    comments: issueData.comments || 0
                  },
                  { upsert: true, new: true }
                );
              }
              console.log(`  ✅ Saved ${actualIssues.length} issues`);

              // Fetch and save releases (changelogs)
              console.log(`  Fetching releases...`);
              const releases = (await github.getChangelogs(owner, repoName)).slice(0, 10);
              console.log(`  Found ${releases.length} releases`);

              for (const releaseData of releases) {
                await Release.findOneAndUpdate(
                  { repositoryId: savedRepo._id, releaseId: releaseData.id },
                  {
                    releaseId: releaseData.id,
                    repositoryId: savedRepo._id,
                    tagName: releaseData.tag_name,
                    name: releaseData.name,
                    body: releaseData.body,
                    draft: releaseData.draft,
                    prerelease: releaseData.prerelease,
                    createdAt: new Date(releaseData.created_at),
                    publishedAt: releaseData.published_at ? new Date(releaseData.published_at) : null,
                    author: {
                      login: releaseData.author?.login,
                      avatarUrl: releaseData.author?.avatar_url,
                      url: releaseData.author?.html_url
                    },
                    url: releaseData.url,
                    htmlUrl: releaseData.html_url,
                    tarballUrl: releaseData.tarball_url,
                    zipballUrl: releaseData.zipball_url,
                    assets: releaseData.assets.map(asset => ({
                      name: asset.name,
                      label: asset.label,
                      contentType: asset.content_type,
                      size: asset.size,
                      downloadCount: asset.download_count,
                      browserDownloadUrl: asset.browser_download_url
                    }))
                  },
                  { upsert: true, new: true }
                );
              }
              console.log(`  ✅ Saved ${releases.length} releases`);

              // Update repository stats
              savedRepo.stats = {
                stars: savedRepo.stats.stars,
                forks: savedRepo.stats.forks,
                commits: commits.length,
                pulls: pulls.length,
                issues: actualIssues.length
              };
              await savedRepo.save();
              console.log(`  ✅ Updated repository stats for ${savedRepo.fullName}`);

            } catch (dataError) {
              console.error(`Error fetching data for ${savedRepo.fullName}:`, dataError.message);
            }

          } catch (saveError) {
            console.error(
              `❌ Failed to save repository ${repoData.name}:`,
              saveError.message
            );
            console.error(
              "Repository data:",
              JSON.stringify(repository.toObject(), null, 2)
            );
          }
        }
      } catch (userRepoError) {
        console.error(
          "Error fetching personal repositories:",
          userRepoError.message
        );
        console.error("Full error:", userRepoError);
      }

      // Then fetch organizations and their repositories
      const orgsData = await github.getOrganizations();
      console.log(`Found ${orgsData.length} organizations`);

      for (const orgData of orgsData) {
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
        try {
          const reposData = await github.getRepositories(orgData.login);
          console.log(
            `Found ${reposData.length} repositories for org ${orgData.login}`
          );

          for (const repoData of reposData) {
            let repository = await Repository.findOne({ repoId: repoData.id });

            if (!repository) {
              repository = new Repository({
                repoId: repoData.id,
                name: repoData.name,
                fullName: repoData.full_name,
                description: repoData.description,
                private: repoData.private,
                organizationId: organization._id,
                stats: {
                  stars: repoData.stargazers_count,
                  forks: repoData.forks_count,
                  issues: 0,
                  pulls: 0,
                  commits: 0,
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
          }
        } catch (repoError) {
          console.error(
            `Error fetching repos for ${orgData.login}:`,
            repoError.message
          );
          // Continue with other organizations
        }
      }

      // Update integration
      integration.organizations = organizationIds;
      integration.lastSynced = new Date();
      await integration.save();

      console.log("Sync completed successfully");
    } catch (syncError) {
      console.error("Error during sync:", syncError.message);
      // Return the integration even if sync fails
    }
    // }

    // Return the integration with populated organizations
    const populatedIntegration = await GitHubIntegration.findById(
      integration._id
    ).populate("organizations");

    res.status(200).json({
      success: true,
      data: populatedIntegration,
      message: "Integration initialized successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get current integration repositories
exports.getCurrentRepositories = async (req, res, next) => {
  try {
    const accessToken = req.accessToken;
    const {
      page = 1,
      pageSize = 10,
      search,
      sortBy = "name",
      sortOrder = "asc",
      minStars,
      minForks,
      minIssues,
    } = req.query;

    // to
    const integration = await getCurrentIntegration(accessToken);
    if (!integration) {
      return next(
        new AppError(
          "No integration found. Please initialize integration first.",
          404
        )
      );
    }

    if (!integration.organizations || integration.organizations.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: 0,
          pages: 0,
        },
        message: "No organizations found. Please sync your integration.",
      });
    }

    let query = {
      organizationId: { $in: integration.organizations },
    };

    // Apply search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Apply numeric filters
    if (minStars) query["stats.stars"] = { $gte: parseInt(minStars) };
    if (minForks) query["stats.forks"] = { $gte: parseInt(minForks) };
    if (minIssues) query["stats.issues"] = { $gte: parseInt(minIssues) };

    // Execute query with pagination and sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const [repositories, total] = await Promise.all([
      Repository.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(pageSize))
        .populate("organizationId", "name"),
      Repository.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: repositories,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        pages: Math.ceil(total / parseInt(pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current integration organizations
exports.getCurrentOrganizations = async (req, res, next) => {
  try {
    const accessToken = req.accessToken;
    const { page = 1, pageSize = 10, search } = req.query;

    const integration = await getCurrentIntegration(accessToken);
    if (!integration) {
      return next(new AppError("No integration found", 404));
    }

    let query = { _id: { $in: integration.organizations } };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize);

    const [organizations, total] = await Promise.all([
      Organization.find(query)
        .skip(skip)
        .limit(parseInt(pageSize))
        .sort({ name: 1 }),
      Organization.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: organizations,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        pages: Math.ceil(total / parseInt(pageSize)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get current integration details
exports.getCurrentIntegration = async (req, res, next) => {
  try {
    const accessToken = req.accessToken;

    const integration = await getCurrentIntegration(accessToken);
    if (!integration) {
      return next(new AppError("No integration found", 404));
    }

    res.status(200).json({
      success: true,
      data: integration,
    });
  } catch (error) {
    next(error);
  }
};

// Create or get current integration
exports.createCurrentIntegration = async (req, res, next) => {
  try {
    const accessToken = req.accessToken;

    if (!accessToken) {
      return next(new AppError("Access token required", 401));
    }

    // Check if integration already exists for this token
    let integration = await GitHubIntegration.findOne({ accessToken });
    if (integration) {
      return res.status(200).json({
        success: true,
        data: integration,
      });
    }

    return next(
      new AppError(
        "Integration not found. Please complete OAuth flow first.",
        404
      )
    );
  } catch (error) {
    next(error);
  }
};

// Sync current integration
exports.syncCurrentIntegration = async (req, res, next) => {
  try {
    const accessToken = req.accessToken;

    // Get current integration
    const integration = await getCurrentIntegration(accessToken);
    if (!integration) {
      return next(
        new AppError(
          "No integration found. Please initialize integration first.",
          404
        )
      );
    }

    const github = new GitHubService(integration.accessToken);

    // Get user data
    const userData = await github.getUser();
    console.log("Fetched user data:", userData.login);

    const organizationIds = [];

    // Create/update user's personal organization
    let userOrganization = await Organization.findOne({ orgId: userData.id });

    if (!userOrganization) {
      userOrganization = new Organization({
        orgId: userData.id,
        name: userData.login,
        description:
          userData.bio || `Personal repositories for ${userData.login}`,
        avatarUrl: userData.avatar_url,
        publicRepos: userData.public_repos,
        publicGists: userData.public_gists,
        followers: userData.followers,
        following: userData.following,
      });
    } else {
      userOrganization.name = userData.login;
      userOrganization.description =
        userData.bio || `Personal repositories for ${userData.login}`;
      userOrganization.avatarUrl = userData.avatar_url;
      userOrganization.publicRepos = userData.public_repos;
      userOrganization.publicGists = userData.public_gists;
      userOrganization.followers = userData.followers;
      userOrganization.following = userData.following;
      userOrganization.lastSynced = new Date();
    }
    await userOrganization.save();
    organizationIds.push(userOrganization._id);

    // Sync user repositories
    console.log(`Syncing personal repositories for ${userData.login}`);
    const reposData = await github.getUserRepositories();
    console.log(`Found ${reposData.length} personal repositories`);

    for (const repoData of reposData) {
      let repository = await Repository.findOne({ repoId: repoData.id });

      if (!repository) {
        repository = new Repository({
          repoId: repoData.id,
          name: repoData.name,
          fullName: repoData.full_name,
          description: repoData.description,
          private: repoData.private,
          organizationId: userOrganization._id,
          stats: {
            stars: repoData.stargazers_count,
            forks: repoData.forks_count,
            issues: 0,
            pulls: 0,
            commits: 0,
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

      // Fetch and store commits for this repository
      try {
        console.log(`Fetching commits for ${repository.fullName}...`);
        const commits = (await github.getCommits(userData.login, repository.name)).slice(0, 10);

        // Save commits to database
        for (const commitData of commits) {
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

        // Fetch pull requests
        const pullRequests = (await github.getPullRequests(userData.login, repository.name)).slice(0, 10);
        console.log("pullRequests ....", pullRequests);

        for (const pr of pullRequests) {
          await PullRequest.findOneAndUpdate(
            { number: pr.number, repositoryId: repository._id },
            {
              number: pr.number,
              title: pr.title,
              body: pr.body,
              state: pr.state,
              repositoryId: repository._id,
              author: {
                login: pr.user?.login,
                avatarUrl: pr.user?.avatar_url,
              },
              createdAt: new Date(pr.created_at),
              updatedAt: new Date(pr.updated_at),
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
              url: pr.html_url,
            },
            { upsert: true, new: true }
          );
        } 

        // Fetch issues
        const issues = (await github.getIssues(userData.login, repository.name)).slice(0, 10);

        for (const issue of issues) {
          // Skip pull requests (they're a subset of issues)
          if (issue.pull_request) continue;

          await Issue.findOneAndUpdate(
            { number: issue.number, repositoryId: repository._id },
            {
              number: issue.number,
              title: issue.title,
              body: issue.body,
              state: issue.state,
              repositoryId: repository._id,
              author: {
                login: issue.user?.login,
                avatarUrl: issue.user?.avatar_url,
              },
              createdAt: new Date(issue.created_at),
              updatedAt: new Date(issue.updated_at),
              closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
              url: issue.html_url,
            },
            { upsert: true, new: true }
          );
        }

        // Update repository stats with commit count
        repository.stats.commits = commits.length;
        await repository.save();
        console.log(
          `Saved ${commits.length} commits for ${repository.fullName}`
        );
      } catch (commitError) {
        console.error(
          `Error fetching commits for ${repository.fullName}:`,
          commitError.message
        );
      }
    }

    // Update integration
    integration.organizations = organizationIds;
    integration.lastSynced = new Date();
    await integration.save();

    res.status(200).json({
      success: true,
      data: integration,
    });
  } catch (error) {
    next(error);
  }
};

// Sync individual repository
exports.syncCurrentRepository = async (req, res, next) => {
  try {
    const accessToken = req.accessToken;
    const repositoryId = req.params.id;

    // Find the repository
    const repository = await Repository.findById(repositoryId);
    if (!repository) {
      return next(new AppError("Repository not found", 404));
    }

    // Get the integration to access GitHub API
    const integration = await getCurrentIntegration(accessToken);
    if (!integration) {
      return next(new AppError("No integration found", 404));
    }

    const github = new GitHubService(integration.accessToken);

    // Get repository details from GitHub
    try {
      // For user repositories, we need to use the user's login
      const userData = await github.getUser();
      const [owner, repoName] = repository.fullName.split("/");

      // Fetch fresh repository data from GitHub
      const repoResponse = await github.client.get(
        `/repos/${owner}/${repoName}`
      );
      const repoData = repoResponse.data;

      // Update repository with fresh data
      repository.name = repoData.name;
      repository.fullName = repoData.full_name;
      repository.description = repoData.description;
      repository.private = repoData.private;
      repository.stats.stars = repoData.stargazers_count;
      repository.stats.forks = repoData.forks_count;
      repository.lastSynced = new Date();

      // Fetch and store commits
      console.log(`Fetching commits for ${repository.fullName}...`);
      const commits = (await github.getCommits(owner, repoName)).slice(0, 10);

      // Save commits to database
      for (const commitData of commits) {
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

      // Update repository stats with commit count
      repository.stats.commits = commits.length;
      console.log(`Saved ${commits.length} commits for ${repository.fullName}`);

      // Fetch additional stats (issues, pulls)
      try {
        const [issuesResponse, pullsResponse] = await Promise.all([
          github.client.get(
            `/repos/${owner}/${repoName}/issues?state=all&per_page=1`
          ),
          github.client.get(
            `/repos/${owner}/${repoName}/pulls?state=all&per_page=1`
          ),
        ]);

        // GitHub API returns total count in headers
        repository.stats.issues = parseInt(
          issuesResponse.headers["x-total-count"] || "0"
        );
        repository.stats.pulls = parseInt(
          pullsResponse.headers["x-total-count"] || "0"
        );
      } catch (statsError) {
        console.log("Could not fetch detailed stats:", statsError.message);
      }

      await repository.save();

      res.status(200).json({
        success: true,
        data: repository,
        message: "Repository synced successfully",
      });
    } catch (githubError) {
      console.error(
        "Error syncing repository from GitHub:",
        githubError.message
      );
      return next(new AppError("Failed to sync repository from GitHub", 500));
    }
  } catch (error) {
    next(error);
  }
};

// Query collection with optional search
exports.queryCollection = async (req, res) => {
  try {
    const { collection } = req.params;
    const { searchText = "" } = req.query;

    if (!collection) {
      return res.status(400).json({ success: false, message: "Collection name is required in the URL." });
    }

    let Model;
    let query = {};
    let textFields = [];

    switch (collection) {
      case "organizations":
        Model = Organization;
        textFields = ["name", "description"];
        break;
      case "repositories":
        Model = Repository;
        textFields = ["name", "description", "fullName"];
        break;
      case "commits":
        Model = Commit;
        textFields = ["message", "author.name", "author.login"];
        break;
      case "pullrequests":
      case "pulls":
        Model = PullRequest;
        textFields = ["title", "body", "user.login"];
        break;
      case "issues":
        Model = Issue;
        textFields = ["title", "body", "user.login"];
        break;
      case "releases":
      case "changelogs":
        Model = Release;
        textFields = ["name", "tagName", "body"];
        break;
      default:
        return res.status(400).json({ success: false, message: `Invalid collection: ${collection}` });
    }

    if (searchText) {
      query.$or = textFields.map(field => ({ [field]: { $regex: searchText, $options: "i" } }));
    }

    const docs = await Model.find(query).limit(100); // limit for safety
    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    console.error("Error in queryCollection:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = exports;
