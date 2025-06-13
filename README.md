# GitHub Integration Backend

This is the backend server for the GitHub Integration application. It provides OAuth authentication with GitHub and API endpoints for fetching GitHub data.

## Prerequisites

- Node.js v22/ExpressJS
- MongoDB
- GitHub OAuth Application credentials

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `env.example` and fill in your configuration:
```bash
cp env.example .env
```

3. Configure GitHub OAuth:
   - Go to GitHub Developer Settings
   - Create a new OAuth Application
   - Set the callback URL to: `http://localhost:3000/auth/github/callback`
   - Copy the Client ID and Client Secret to your `.env` file

## Running the Server

Start the server:
```bash
npm start
```

The server will run on port 3000 by default.

## API Endpoints

### Authentication
- `GET /auth/github` - Initiate GitHub OAuth flow
- `GET /auth/github/callback` - GitHub OAuth callback
- `DELETE /auth/github/:id` - Remove GitHub integration
- `GET /auth/status/:id` - Get integration status

### GitHub Data
- `GET /api/:id/organizations` - Get user organizations
- `GET /api/:id/organizations/:org/repos` - Get organization repositories
- `GET /api/:id/repos/:owner/:repo/commits` - Get repository commits
- `GET /api/:id/repos/:owner/:repo/pulls` - Get repository pulls
- `GET /api/:id/repos/:owner/:repo/issues` - Get repository issues
- `GET /api/:id/repos/:owner/:repo/changelogs` - Get repository changelogs 