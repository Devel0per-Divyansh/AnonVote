const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for voting endpoint to prevent automated vote flooding / DDoS.
 */
const voteRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 10, // Max 10 requests per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many voting requests from this IP network. Please wait a minute and try again.'
    }
});

module.exports = {
    voteRateLimiter
};
