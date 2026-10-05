/**
 * Authentication and authorization middleware.
 */

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: 'Unauthorized: Admin authentication required'
    });
}

function requireJudge(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'judge') {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: 'Unauthorized: Judge authentication required'
    });
}

function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required'
    });
}

module.exports = {
    requireAdmin,
    requireJudge,
    requireAuth
};
