require('dotenv').config();

const config = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    databaseURL: process.env.DATABASE_URL || 'mongodb+srv://chaudharyali0737:jQ5at32Xjzsflehm@githubdemo.anba2hz.mongodb.net/integrations',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    
    github: {
        clientId: process.env.GITHUB_CLIENT_ID || 'your_github_client_id',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your_github_client_secret',
        callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/api/github/auth/callback'
    },

    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:4200/**',
        credentials: true
    },
    
    logs: {
        level: process.env.LOG_LEVEL || 'debug'
    },

    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'your-secret-key'
    }
};

module.exports = config; 