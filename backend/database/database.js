const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'anonvote.sqlite');
const schemaPath = path.join(__dirname, 'schema.sql');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log(`Connected to SQLite database at: ${dbPath}`);
        db.run('PRAGMA foreign_keys = ON');
    }
});

// Helper wrappers for Promises
const query = {
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    },
    exec: (sql) => {
        return new Promise((resolve, reject) => {
            db.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
};

// Initialize schema
async function initDatabase() {
    try {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await query.exec(schemaSql);
        console.log('Database schema initialized successfully.');
    } catch (err) {
        console.error('Error initializing database schema:', err);
    }
}

// Seed Demo Data
async function seedDatabase() {
    await initDatabase();

    try {
        console.log('Seeding demo data...');

        // 1. Seed Admin
        const adminExists = await query.get('SELECT * FROM admin_users WHERE username = ?', ['admin']);
        if (!adminExists) {
            const adminHash = bcrypt.hashSync('admin123', 10);
            await query.run('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', ['admin', adminHash]);
            console.log('Seeded Admin account: admin / admin123');
        }

        // 2. Seed Judges
        let judge1 = await query.get('SELECT * FROM judges WHERE username = ?', ['judge1']);
        if (!judge1) {
            const judge1Hash = bcrypt.hashSync('judge123', 10);
            const res1 = await query.run('INSERT INTO judges (name, username, password_hash) VALUES (?, ?, ?)', [
                'Prof. Sharma (Dance & Choreography)',
                'judge1',
                judge1Hash
            ]);
            judge1 = { id: res1.id };
            console.log('Seeded Judge 1: judge1 / judge123');
        }

        let judge2 = await query.get('SELECT * FROM judges WHERE username = ?', ['judge2']);
        if (!judge2) {
            const judge2Hash = bcrypt.hashSync('judge223', 10); // judge123 or judge223, let's use judge123 for simplicity
            const j2Hash = bcrypt.hashSync('judge123', 10);
            const res2 = await query.run('INSERT INTO judges (name, username, password_hash) VALUES (?, ?, ?)', [
                'Dr. Kapoor (Music & Stage Art)',
                'judge2',
                j2Hash
            ]);
            judge2 = { id: res2.id };
            console.log('Seeded Judge 2: judge2 / judge123');
        }

        // 3. Seed Event
        let event = await query.get('SELECT * FROM events WHERE name = ?', ['Cultural Fest 2026']);
        if (!event) {
            const now = new Date();
            const startTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // Started 1 hour ago
            const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // Ends in 24 hours

            const resEvent = await query.run(
                'INSERT INTO events (name, description, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)',
                [
                    'Cultural Fest 2026',
                    'Annual Intra-College Cultural Extravaganza featuring Dance, Singing, Drama, and Talent Showcase.',
                    startTime,
                    endTime,
                    'active'
                ]
            );
            event = { id: resEvent.id };
            console.log(`Seeded Event: Cultural Fest 2026 (ID: ${event.id})`);
        }

        // 4. Assign Judges to Event
        if (judge1 && event) {
            await query.run('INSERT OR IGNORE INTO event_judges (event_id, judge_id) VALUES (?, ?)', [event.id, judge1.id]);
        }
        if (judge2 && event) {
            await query.run('INSERT OR IGNORE INTO event_judges (event_id, judge_id) VALUES (?, ?)', [event.id, judge2.id]);
        }

        // 5. Seed Participants
        const participants = [
            { name: 'Team Alpha', description: 'High-energy Hip-Hop & Contemporary Fusion Dance Crew' },
            { name: 'Team Beta', description: 'Classical Harmony & Folk Fusion Vocal Ensemble' },
            { name: 'Team Gamma', description: 'Acoustic Rock & Pop Band Showcase' },
            { name: 'Team Delta', description: 'Theatrical Drama & Social Awareness Skit Troupe' }
        ];

        for (const p of participants) {
            const pExists = await query.get('SELECT * FROM participants WHERE event_id = ? AND name = ?', [event.id, p.name]);
            if (!pExists) {
                await query.run('INSERT INTO participants (event_id, name, description) VALUES (?, ?, ?)', [
                    event.id,
                    p.name,
                    p.description
                ]);
            }
        }
        console.log('Seeded 4 demo participants for Cultural Fest 2026.');

        console.log('Demo data seeding completed successfully!');
    } catch (err) {
        console.error('Error seeding demo data:', err);
    }
}

module.exports = {
    db,
    query,
    initDatabase,
    seedDatabase
};
