const crypto = require('crypto');

/**
 * Privacy-Preserving Device Token Handler
 * 
 * Browsers cannot access physical MAC addresses due to security sandboxing.
 * This middleware manages cryptographically secure random anonymous device tokens.
 * 
 * 1. Checks for existing token in cookies or headers (X-Device-Token).
 * 2. Generates a new 256-bit secure random token if absent.
 * 3. Hashes the token using SHA-256 before database operations (never store raw tokens).
 */
function handleDeviceToken(req, res, next) {
    let rawToken = req.cookies.anon_device_token || req.headers['x-device-token'];

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
        // Generate cryptographically secure random token (32 bytes = 256 bits)
        rawToken = crypto.randomBytes(32).toString('hex');
        
        // Set secure HTTP cookie valid for 30 days
        res.cookie('anon_device_token', rawToken, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax'
        });
    }

    // SHA-256 Hash of anonymous device token
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Attach to request
    req.rawDeviceToken = rawToken;
    req.deviceTokenHash = tokenHash;

    next();
}

module.exports = {
    handleDeviceToken
};
