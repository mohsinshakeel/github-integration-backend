const { AppError } = require('./errorHandler');

exports.authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next(new AppError('No authorization token provided', 401));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return next(new AppError('Invalid authorization header format', 401));
    }

    // Store the token for use in subsequent requests to GitHub API
    req.accessToken = token;
    next();
}; 