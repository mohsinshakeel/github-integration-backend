const axios = require('axios');
const { AppError } = require('../middleware/errorHandler');

class GitHubService {
    constructor(accessToken) {
        this.client = axios.create({
            baseURL: 'https://api.github.com',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
    }

    async getOrganizations() {
        try {
            const { data } = await this.client.get('/user/orgs');
            return data;
        } catch (error) {
            throw new AppError('Failed to fetch organizations', 500);
        }
    }

    async getRepositories(org) {
        // Handles organization repositories (with pagination)
        const allRepos = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const { data } = await this.client.get(`/orgs/${org}/repos`, {
                    params: { per_page: 100, page }
                });
                allRepos.push(...data);
                hasMore = data.length === 100;
                page++;
            } catch (error) {
                throw new AppError(`Failed to fetch repositories for ${org}`, 500);
            }
        }
        return allRepos;
    }

    async getUserRepositories() {
        // Handles user repositories (with pagination)
        const allRepos = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const { data } = await this.client.get('/user/repos', {
                    params: {
                        type: 'all',
                        sort: 'updated',
                        per_page: 100,
                        page
                    }
                });
                allRepos.push(...data);
                hasMore = data.length === 100;
                page++;
            } catch (error) {
                throw new AppError('Failed to fetch user repositories', 500);
            }
        }
        return allRepos;
    }

    async getUser() {
        try {
            const { data } = await this.client.get('/user');
            return data;
        } catch (error) {
            throw new AppError('Failed to fetch user data', 500);
        }
    }

    async getCommits(owner, repo) {
        const allCommits = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
                    params: {
                        per_page: 100,
                        page
                    }
                });

                // Check rate limits
                const rateLimit = response.headers['x-ratelimit-remaining'];
                if (rateLimit && parseInt(rateLimit) < 10) {
                    console.warn(`GitHub API rate limit running low: ${rateLimit} requests remaining`);
                }

                const { data } = response;
                allCommits.push(...data);
                hasMore = data.length === 100;
                page++;
            } catch (error) {
                if (error.response && error.response.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
                    throw new AppError('GitHub API rate limit exceeded. Please try again later.', 429);
                }
                throw new AppError(`Failed to fetch commits for ${owner}/${repo}`, 500);
            }
        }
        return allCommits;
    }

    async getPulls(owner, repo) {
        const allPulls = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await this.client.get(`/repos/${owner}/${repo}/pulls`, {
                    params: {
                        state: 'all',
                        per_page: 100,
                        page
                    }
                });

                // Check rate limits
                const rateLimit = response.headers['x-ratelimit-remaining'];
                if (rateLimit && parseInt(rateLimit) < 10) {
                    console.warn(`GitHub API rate limit running low: ${rateLimit} requests remaining`);
                }

                const { data } = response;
                allPulls.push(...data);
                hasMore = data.length === 100;
                page++;
            } catch (error) {
                if (error.response && error.response.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
                    throw new AppError('GitHub API rate limit exceeded. Please try again later.', 429);
                }
                throw new AppError(`Failed to fetch pull requests for ${owner}/${repo}`, 500);
            }
        }
        return allPulls;
    }

    async getIssues(owner, repo) {
        const allIssues = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await this.client.get(`/repos/${owner}/${repo}/issues`, {
                    params: {
                        state: 'all',
                        per_page: 100,
                        page
                    }
                });

                // Check rate limits
                const rateLimit = response.headers['x-ratelimit-remaining'];
                if (rateLimit && parseInt(rateLimit) < 10) {
                    console.warn(`GitHub API rate limit running low: ${rateLimit} requests remaining`);
                }

                const { data } = response;
                allIssues.push(...data);
                hasMore = data.length === 100;
                page++;
            } catch (error) {
                if (error.response && error.response.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
                    throw new AppError('GitHub API rate limit exceeded. Please try again later.', 429);
                }
                throw new AppError(`Failed to fetch issues for ${owner}/${repo}`, 500);
            }
        }
        return allIssues;
    }

    async getChangelogs(owner, repo) {
        const allReleases = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await this.client.get(`/repos/${owner}/${repo}/releases`, {
                    params: {
                        per_page: 100,
                        page
                    }
                });

                // Check rate limits
                const rateLimit = response.headers['x-ratelimit-remaining'];
                if (rateLimit && parseInt(rateLimit) < 10) {
                    console.warn(`GitHub API rate limit running low: ${rateLimit} requests remaining`);
                }

                const { data } = response;
                allReleases.push(...data);
                hasMore = data.length === 100;
                page++;
            } catch (error) {
                if (error.response && error.response.status === 403 && error.response.headers['x-ratelimit-remaining'] === '0') {
                    throw new AppError('GitHub API rate limit exceeded. Please try again later.', 429);
                }
                throw new AppError(`Failed to fetch releases for ${owner}/${repo}`, 500);
            }
        }
        return allReleases;
    }
}

module.exports = GitHubService;