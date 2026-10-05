const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../database/database');

/**
 * POST /api/auth/admin/login
 */
router.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const admin = await query.get('SELECT * FROM admin_users WHERE username = ?', [username.trim()]);
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

        const isMatch = bcrypt.compareSync(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials'
            });
        }

        req.session.user = {
            id: admin.id,
            username: admin.username,
            role: 'admin'
        };

        return res.json({
            success: true,
            message: 'Admin login successful',
            data: {
                id: admin.id,
                username: admin.username,
                role: 'admin'
            }
        });
    } catch (err) {
        console.error('Error in admin login:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during login'
        });
    }
});

/**
 * POST /api/auth/judge/login
 */
router.post('/judge/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const judge = await query.get('SELECT * FROM judges WHERE username = ?', [username.trim()]);
        if (!judge) {
            return res.status(401).json({
                success: false,
                message: 'Invalid judge credentials'
            });
        }

        const isMatch = bcrypt.compareSync(password, judge.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid judge credentials'
            });
        }

        req.session.user = {
            id: judge.id,
            name: judge.name,
            username: judge.username,
            role: 'judge'
        };

        return res.json({
            success: true,
            message: 'Judge login successful',
            data: {
                id: judge.id,
                name: judge.name,
                username: judge.username,
                role: 'judge'
            }
        });
    } catch (err) {
        console.error('Error in judge login:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error during login'
        });
    }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Failed to logout session'
            });
        }
        res.clearCookie('connect.sid');
        return res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});

/**
 * GET /api/auth/me
 */
router.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        return res.json({
            success: true,
            data: req.session.user
        });
    }
    return res.json({
        success: false,
        message: 'Not authenticated'
    });
});

module.exports = router;
