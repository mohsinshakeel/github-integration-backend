# GitHub Integration API Endpoints

Base URL: `http://localhost:3000`

## Authentication

### GitHub OAuth Login
```
GET /api/github/auth/github
```
Initiates GitHub OAuth flow. Redirects to GitHub for authentication.

### GitHub OAuth Callback
```
GET /api/github/auth/callback
```
Handles GitHub OAuth callback. Redirects to Angular app with token:
`http://localhost:4200/auth/callback?token=GITHUB_ACCESS_TOKEN`

### Get User Profile
```
GET /api/github/auth/profile
Authorization: Bearer {token}
```
Returns the current user's GitHub profile.

### Logout
```
POST /api/github/auth/logout
Authorization: Bearer {token}
```

## Current Integration (Angular App Compatible)

### Get Current Integration
```
GET /api/integration/current
Authorization: Bearer {token}
```
Returns the current user's integration.

### Create Current Integration
```
POST /api/integration/current
Authorization: Bearer {token}
```
Creates a new integration for the current user.

### Sync Current Integration
```
POST /api/integration/current/sync
Authorization: Bearer {token}
```
Syncs the current user's GitHub data.

### Get Current Integration Repositories
```
GET /api/integration/current/repositories
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10)
- `search` (optional): Search repositories by name or description
- `sortBy` (optional): Field to sort by (name, stats.stars, stats.forks, lastSynced)
- `sortOrder` (optional): 'asc' or 'desc' (default: 'asc')
- `minStars` (optional): Filter by minimum stars
- `minForks` (optional): Filter by minimum forks
- `minIssues` (optional): Filter by minimum issues

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "repo_id",
      "repoId": 67890,
      "name": "repository-name",
      "description": "Repository description",
      "private": false,
      "stats": {
        "stars": 150,
        "forks": 25,
        "issues": 5,
        "pulls": 3,
        "commits": 200
      },
      "organizationId": {
        "_id": "org_id",
        "name": "organization-name"
      },
      "lastSynced": "2023-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "pages": 10
  }
}
```

### Get Current Integration Organizations
```
GET /api/integration/current/organizations
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10)
- `search` (optional): Search term for name or description

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "org_id",
      "orgId": 12345,
      "name": "organization-name",
      "description": "Organization description",
      "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
      "publicRepos": 50,
      "publicGists": 5,
      "followers": 100,
      "following": 10,
      "lastSynced": "2023-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 25,
    "pages": 3
  }
}
```

## Integration Management (Full API)

### Create Integration
```
POST /api/github/integration
Authorization: Bearer {token}
```
Creates a new GitHub integration for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "integration_id",
    "accessToken": "github_token",
    "userId": "user_id",
    "organizations": [],
    "createdAt": "2023-01-01T00:00:00.000Z",
    "lastSynced": null
  }
}
```

### Get All Integrations
```
GET /api/github/integrations
Authorization: Bearer {token}
```

### Get Single Integration
```
GET /api/github/integration/{id}
Authorization: Bearer {token}
```

### Sync Integration
```
POST /api/github/integration/{id}/sync
Authorization: Bearer {token}
```
Fetches and syncs all organizations and repositories for the integration.

### Delete Integration
```
DELETE /api/github/integration/{id}
Authorization: Bearer {token}
```

## Organizations

### Get Organizations
```
GET /api/github/integration/{id}/data?collection=organizations
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search term for name or description

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "org_id",
      "orgId": 12345,
      "name": "organization-name",
      "description": "Organization description",
      "avatarUrl": "https://avatars.githubusercontent.com/u/12345",
      "publicRepos": 50,
      "publicGists": 5,
      "followers": 100,
      "following": 10,
      "lastSynced": "2023-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## Repositories

### Get Repositories (Advanced)
```
GET /api/github/integration/{id}/repositories
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search repositories by name or description
- `sortBy` (optional): Field to sort by (name, stats.stars, stats.forks, lastSynced)
- `sortOrder` (optional): 'asc' or 'desc' (default: 'asc')
- `minStars` (optional): Filter by minimum stars
- `minForks` (optional): Filter by minimum forks
- `minIssues` (optional): Filter by minimum issues

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "repo_id",
      "repoId": 67890,
      "name": "repository-name",
      "description": "Repository description",
      "private": false,
      "stats": {
        "stars": 150,
        "forks": 25,
        "issues": 5,
        "pulls": 3,
        "commits": 200
      },
      "organizationId": {
        "_id": "org_id",
        "name": "organization-name"
      },
      "lastSynced": "2023-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

### Get Repositories (Simple)
```
GET /api/github/integration/{id}/data?collection=repositories
Authorization: Bearer {token}
```

### Get Single Repository
```
GET /api/github/integration/{id}/repository/{repoId}
Authorization: Bearer {token}
```

### Get Repository Stats
```
GET /api/github/integration/{id}/repository/{repoId}/stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stars": 150,
    "forks": 25,
    "issues": 5,
    "pulls": 3,
    "commits": 200
  }
}
```

### Sync Single Repository
```
POST /api/github/integration/{id}/repository/{repoId}/sync
Authorization: Bearer {token}
```

## Commits, Pulls, Issues, Changelogs

### Get Commits
```
GET /api/github/integration/{id}/data?collection=commits
Authorization: Bearer {token}
```

### Get Pull Requests
```
GET /api/github/integration/{id}/data?collection=pulls
Authorization: Bearer {token}
```

### Get Issues
```
GET /api/github/integration/{id}/data?collection=issues
Authorization: Bearer {token}
```

### Get Changelogs
```
GET /api/github/integration/{id}/data?collection=changelogs
Authorization: Bearer {token}
```

**Query Parameters for all above:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `search` (optional): Search term

## Health Check

### Server Health
```
GET /health
```
Returns server status and timestamp.

## Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

## Authentication

All API endpoints (except `/health` and auth endpoints) require the `Authorization` header:
```
Authorization: Bearer YOUR_GITHUB_ACCESS_TOKEN
```

The token is obtained after successful GitHub OAuth authentication and returned in the callback URL.

## Angular App Integration

For your Angular app running on port 4200, use these endpoints:

1. **Authentication Flow:**
   - Redirect to: `http://localhost:3000/api/github/auth/github`
   - Handle callback at: `http://localhost:4200/auth/callback?token={token}`

2. **Get Repositories (matches your current call):**
   ```
   GET /api/integration/current/repositories?page=1&pageSize=20
   ```

3. **Get Organizations:**
   ```
   GET /api/integration/current/organizations?page=1&pageSize=20
   ```

4. **Sync Data:**
   ```
   POST /api/integration/current/sync
   ```

5. **Create Integration:**
   ```
   POST /api/integration/current
   ```

All endpoints require the GitHub access token in the Authorization header:
```
Authorization: Bearer {github_access_token}
``` 