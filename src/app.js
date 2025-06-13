const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const passport = require('passport');
const session = require('express-session');
const GitHubStrategy = require('passport-github2').Strategy;
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const mongoose = require('mongoose');

// Import routes
const authRoutes = require('./routes/auth.routes');
const integrationRoutes = require('./routes/integration.routes');
const repositoryRoutes = require('./routes/repository.routes');
const currentRoutes = require('./routes/current.routes');

const app = express();

// Middleware
app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials
}));


// app.use(cors({
//     origin: true,
//     credentials: true
// }));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: config.session.secret || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Configure GitHub Strategy
passport.use(new GitHubStrategy({
    clientID: config.github.clientId,
    clientSecret: config.github.clientSecret,
    callbackURL: config.github.callbackURL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        return done(null, { profile, accessToken });
    } catch (error) {
        return done(error, null);
    }
}));

// Routes
app.use('/api/github/auth', authRoutes);
app.use('/api/github', integrationRoutes);
app.use('/api/github', repositoryRoutes);

// Routes for Angular app compatibility (shorter paths)
app.use('/api', currentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use(errorHandler);

module.exports = app; 