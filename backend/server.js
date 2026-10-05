const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
require('dotenv').config();

const { seedDatabase } = require('./database/database');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const votingRoutes = require('./routes/voting');
const judgeRoutes = require('./routes/judges');
const resultsRoutes = require('./routes/results');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'anonvote_secret_key_fest_2026_super_secure',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // Set to true if HTTPS
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/events', votingRoutes);
app.use('/api', judgeRoutes);
app.use('/api/events', resultsRoutes);

// Static Frontend Serving
app.use(express.static(path.join(__dirname, '../frontend')));

// Fallback to index.html for SPA routing if needed
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// Startup & Auto-seed
async function startServer() {
    await seedDatabase();
    app.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(` AnonVote Server Running at: http://localhost:${PORT}`);
        console.log(` Public Audience Voting:  http://localhost:${PORT}/vote.html?event=1`);
        console.log(` Admin Portal:            http://localhost:${PORT}/admin.html`);
        console.log(` Judge Portal:            http://localhost:${PORT}/judge.html`);
        console.log(` Results Leaderboard:     http://localhost:${PORT}/results.html?event=1`);
        console.log(`====================================================`);
    });
}

if (require.main === module) {
    startServer();
}

module.exports = app;
