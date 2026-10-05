# AnonVote — Anonymous Voting System

Production-quality, full-stack web application designed for college cultural events (dance, singing, fashion shows, drama, talent shows, and battle of bands).

AnonVote combines **Judge evaluations (33.33%)** and **Audience voting (66.67%)** to automatically calculate normalized scores and rank participants when voting closes, while maintaining privacy-preserving duplicate-vote prevention without requiring user registration or fake browser MAC claims.

---

## 📌 Problem Statement

College cultural competitions traditionally struggle with two primary scoring challenges:
1. **Bias & Popularity Skew**: Pure audience voting often turns into a raw popularity contest, disregarding technical mastery. Conversely, pure judge scoring fails to capture crowd engagement and enthusiasm.
2. **Duplicate Audience Voting**: Standard online voting forms suffer from ballot stuffing or require intrusive personal data (phone numbers, student roll numbers, emails), destroying audience privacy and lowering engagement.

---

## 🎯 Objectives

- **Balanced Normalization**: Combine 1/3 Judge weight (technical & artistic merit) and 2/3 Audience weight (crowd response).
- **Privacy-Preserving Anonymity**: Allow instant audience voting via QR code without asking for names, emails, phone numbers, or college IDs.
- **Secure Duplicate Prevention**: Enforce 1 vote per device per event using cryptographically hashed anonymous device tokens without making false browser MAC address claims.
- **Full Transparency**: Provide real-time live standings, judge evaluation tracking, and official locked result publishing.

---

## 📐 Scoring Formula & Normalization Math

When voting closes, AnonVote computes the final score for each participant using the following deterministic formula:

$$\text{Final Score} = (\text{Normalized Judge Score} \times 0.3333) + (\text{Normalized Audience Score} \times 0.6667)$$

### 1. Normalized Judge Score (0–100)
Judges evaluate participants across 5 categories (Max 20 points each = 100 points total per judge):
- Performance (0 - 20)
- Creativity (0 - 20)
- Stage Presence (0 - 20)
- Technical Execution (0 - 20)
- Overall Impact (0 - 20)

If multiple judges evaluate a participant, the average judge total is computed:

$$\text{Judge Score} = \frac{1}{N_{\text{judges}}} \sum_{i=1}^{N_{\text{judges}}} \text{Judge Total}_i$$

### 2. Normalized Audience Score (0–100)
Audience votes are counted for each participant. Let $V_p$ be the valid votes for participant $p$, and $V_{\max} = \max_i(V_i)$ be the highest vote count among all participants in the event:

$$\text{Audience Score} = \begin{cases} \left(\frac{V_p}{V_{\max}}\right) \times 100 & \text{if } V_{\max} > 0 \\ 0 & \text{if } V_{\max} = 0 \end{cases}$$

### 3. Deterministic Ranking & Tie Handling
Participants are sorted descending by $\text{Final Score}$ (rounded to 2 decimal places). In case of exact numerical ties:
1. Higher $\text{Normalized Judge Score}$ wins.
2. Participant ID ascending (deterministic tie-breaker).

---

## 🔒 Privacy Model & MAC-Address Limitation Analysis

### Why Physical MAC Collection is Not Possible in Web Browsers
Modern web browsers sandbox JavaScript execution for user privacy and security. Standard browser APIs (W3C standard) **cannot and do not expose physical network MAC addresses**. Any web app claiming to collect raw device MAC addresses via browser JS is either using deprecated ActiveX/NPAPI plugins or making false claims.

### Privacy-Preserving Alternative Implemented in AnonVote
AnonVote implements robust duplicate-vote prevention at the server layer:
1. **Cryptographic Anonymous Device Token**: When an audience member accesses the voting page, Node.js generates a 256-bit cryptographically secure random token (`crypto.randomBytes(32)`).
2. **SHA-256 Server Token Hashing**: Raw tokens are never stored in the database. The server hashes the token using `SHA-256` before database lookup or insertion.
3. **Database Uniqueness**: SQLite table `audience_votes` enforces `UNIQUE(event_id, anonymous_token_hash)`.
4. **Cookie & Header Persistence**: Tokens are stored in `httpOnly`, `SameSite=Lax` cookies with `localStorage` fallback.
5. **IP Rate Limiting**: `express-rate-limit` prevents automated ballot stuffing from a single IP network.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Dark Mode & Glassmorphism Design System), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.js.
- **Database**: SQLite3 (`sqlite3` engine with native transactions and foreign key constraints).
- **Dependencies**: `express`, `sqlite3`, `bcryptjs`, `express-session`, `cookie-parser`, `cors`, `qrcode`, `express-rate-limit`, `dotenv`.

---

## 🗄️ Database Architecture & Schema Design

```sql
PRAGMA foreign_keys = ON;

admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT CHECK(status IN ('draft', 'active', 'voting_closed', 'results_locked')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

event_judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    judge_id INTEGER NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
    UNIQUE(event_id, judge_id)
);

participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

judge_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    judge_id INTEGER NOT NULL,
    performance REAL DEFAULT 0,
    creativity REAL DEFAULT 0,
    stage_presence REAL DEFAULT 0,
    technical_execution REAL DEFAULT 0,
    overall_impact REAL DEFAULT 0,
    total_score REAL DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
    UNIQUE(event_id, judge_id, participant_id)
);

audience_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    anonymous_token_hash TEXT NOT NULL,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE,
    UNIQUE(event_id, anonymous_token_hash)
);
```

---

## 📡 API Endpoints Specification

### Auth Routes (`/api/auth`)
- `POST /api/auth/admin/login` - Admin authentication
- `POST /api/auth/judge/login` - Judge authentication
- `POST /api/auth/logout` - Clear active session
- `GET /api/auth/me` - Fetch active session info

### Events Routes (`/api/events`)
- `GET /api/events` - List all events & vote summary
- `GET /api/events/:id` - Detailed event details
- `POST /api/events` - Create event (Admin)
- `PUT /api/events/:id` - Update event / status (Admin)
- `DELETE /api/events/:id` - Delete event (Admin)
- `POST /api/events/:id/participants` - Add participant (Admin)
- `DELETE /api/events/:id/participants/:participantId` - Delete participant (Admin)
- `POST /api/events/:id/judges` - Assign judges to event (Admin)
- `GET /api/events/:id/qr` - Generate event QR code Data URL

### Voting Routes (`/api/events`)
- `GET /api/events/:id/voting-status` - Check status & device vote record
- `POST /api/events/:id/vote` - Submit audience vote

### Judge Scoring Routes (`/api`)
- `POST /api/judges` - Create new judge (Admin)
- `GET /api/judges` - List all judges
- `GET /api/events/:id/judge-status` - Check judge scoring progress
- `POST /api/events/:id/judge-score` - Submit / lock judge evaluation card (Judge)

### Results Routes (`/api/events`)
- `GET /api/events/:id/results` - Calculate normalized leaderboard & podium
- `POST /api/events/:id/lock-results` - Lock final results (Admin)

---

## 🔑 Pre-Seeded Development Demo Credentials

When the server starts, it automatically seeds a demo event: **"Cultural Fest 2026"** (ID: `1`) with 4 participants:
- `Team Alpha` (Hip-Hop & Fusion Crew)
- `Team Beta` (Classical Vocal Ensemble)
- `Team Gamma` (Acoustic Rock Band)
- `Team Delta` (Theatrical Skit Troupe)

### Access Credentials:
- **Admin**: Username: `admin` | Password: `admin123`
- **Judge 1 (Prof. Sharma)**: Username: `judge1` | Password: `judge123`
- **Judge 2 (Dr. Kapoor)**: Username: `judge2` | Password: `judge123`

---

## 🚀 Installation & Running Locally

### Prerequisites:
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run Seed Script (Optional - Auto-ran on server start)
```bash
npm run seed
```

### Step 3: Run Automated Integration Tests
```bash
npm test
```

### Step 4: Start Server
```bash
npm start
```

Access the application in your browser:
- **Portal Gateway**: `http://localhost:3000/index.html`
- **Audience Voting**: `http://localhost:3000/vote.html?event=1`
- **Judge Portal**: `http://localhost:3000/judge.html`
- **Admin Dashboard**: `http://localhost:3000/admin.html`
- **Results Leaderboard**: `http://localhost:3000/results.html?event=1`

---

## 🧪 Verification Workflow Guide

Follow this step-by-step procedure to demonstrate the full application flow:

1. **Admin Login**: Go to `/admin.html`, fill `admin` / `admin123`.
2. **Event & QR Code**: View pre-created event "Cultural Fest 2026". Click **"Show QR Code"** to display the generated voting QR code.
3. **Audience Vote**: Open `/vote.html?event=1` in your browser. Select `Team Alpha` and click **"Submit Vote"**. Confirm success message.
4. **Duplicate Prevention Verification**: Refresh or re-submit a vote on `/vote.html?event=1`. Notice the immediate rejection toast: `"Duplicate vote rejected: Your device has already submitted a vote for this event."`
5. **Judge Evaluation**: Open `/judge.html`, fill `judge1` / `judge123`. Score `Team Alpha` across Performance, Creativity, Stage Presence, Technical Execution, and Impact (e.g. 18, 19, 17, 18, 19 = 91/100). Click **"Submit & Lock Evaluation"**.
6. **Closing Voting & Locking Results**: Go back to `/admin.html`. Click **"Stop Voting"** and then **"Lock Results"**.
7. **View Final Leaderboard**: Open `/results.html?event=1`. Verify that `Team Alpha` appears on the **Gold Champion Podium** with the exact formula output:
   $$\text{Final Score} = (91.00 \times 0.3333) + (100.00 \times 0.6667) = 97.00$$

---

## 🔮 Future Scope & Limitations

- **Network-Level Captive Portal Integration**: The architecture allows network routers or WiFi access points at college venues to pass hardware MAC headers (`X-MAC-Address`) to the Node.js proxy layer for optional router-level hardware enforcement.
- **WebSocket Real-time Updates**: Real-time push updates via WebSockets (Socket.io) can be attached for instantaneous stadium scoreboard refreshes during live performances.
