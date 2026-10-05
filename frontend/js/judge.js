document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const judgeDashboardSection = document.getElementById('judgeDashboardSection');
    const judgeLoginForm = document.getElementById('judgeLoginForm');
    const judgeUsernameInput = document.getElementById('judgeUsername');
    const judgePasswordInput = document.getElementById('judgePassword');
    const judgeUserInfo = document.getElementById('judgeUserInfo');
    const judgeLogoutBtn = document.getElementById('judgeLogoutBtn');
    const loginToast = document.getElementById('loginToast');
    const toastContainer = document.getElementById('toastContainer');
    const eventSelect = document.getElementById('eventSelect');
    const scoringContainer = document.getElementById('participantScoringContainer');

    let currentUser = null;
    let currentEventId = null;

    window.quickFillJudge = (username, password) => {
        judgeUsernameInput.value = username;
        judgePasswordInput.value = password;
    };

    function showToast(msg, type = 'success', container = toastContainer) {
        container.innerHTML = `
            <div class="toast toast-${type}">
                <span>${type === 'success' ? '✅' : '⚠️'}</span>
                <span>${msg}</span>
            </div>
        `;
    }

    // 1. Check Session
    async function checkAuthStatus() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();

            if (data.success && data.data.role === 'judge') {
                currentUser = data.data;
                showDashboard();
            } else {
                showLogin();
            }
        } catch (err) {
            showLogin();
        }
    }

    function showLogin() {
        loginSection.style.display = 'block';
        judgeDashboardSection.style.display = 'none';
        judgeUserInfo.textContent = '';
        judgeLogoutBtn.style.display = 'none';
    }

    function showDashboard() {
        loginSection.style.display = 'none';
        judgeDashboardSection.style.display = 'block';
        judgeUserInfo.textContent = `👨‍⚖️ ${currentUser.name || currentUser.username}`;
        judgeLogoutBtn.style.display = 'inline-block';
        loadAssignedEvents();
    }

    function formatEventStatus(status) {
        const labels = {
            draft: 'Draft',
            active: 'Active',
            voting_closed: 'Voting Closed',
            results_locked: 'Results Locked'
        };

        return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    }

    // 2. Login Handler
    judgeLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = judgeUsernameInput.value.trim();
        const password = judgePasswordInput.value;

        try {
            const res = await fetch('/api/auth/judge/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (data.success) {
                currentUser = data.data;
                showDashboard();
            } else {
                showToast(data.message || 'Invalid judge credentials', 'error', loginToast);
            }
        } catch (err) {
            const isFileAccess = window.location.protocol === 'file:';
            if (isFileAccess) {
                showToast('Open the app via http://localhost:3000 to log in', 'error', loginToast);
            } else {
                showToast('Network error during login. Start the server with "npm start".', 'error', loginToast);
            }
        }
    });

    // 3. Logout Handler
    judgeLogoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        showLogin();
    });

    // 4. Load Events assigned to judge
    async function loadAssignedEvents() {
        try {
            const res = await fetch('/api/events');
            const data = await res.json();

            if (data.success && data.data.length > 0) {
                eventSelect.innerHTML = data.data.map(ev => 
                    `<option value="${ev.id}">${escapeHtml(ev.name)} (${formatEventStatus(ev.status)})</option>`
                ).join('');

                currentEventId = data.data[0].id;
                eventSelect.value = currentEventId;
                loadParticipantsAndScores();
            } else {
                eventSelect.innerHTML = '<option value="">No events found</option>';
                scoringContainer.innerHTML = '<div class="card"><p style="color: var(--text-muted);">No events currently assigned.</p></div>';
            }
        } catch (err) {
            console.error('Error fetching events:', err);
        }
    }

    eventSelect.addEventListener('change', (e) => {
        currentEventId = e.target.value;
        if (currentEventId) loadParticipantsAndScores();
    });

    // 5. Load Participants & Existing Scores
    async function loadParticipantsAndScores() {
        if (!currentEventId) return;

        try {
            const [pRes, statusRes] = await Promise.all([
                fetch(`/api/events/${currentEventId}/participants`),
                fetch(`/api/events/${currentEventId}/judge-status`)
            ]);

            const pData = await pRes.json();
            const statusData = await statusRes.json();

            if (!pData.success || !pData.data.length) {
                scoringContainer.innerHTML = '<div class="card"><p style="color: var(--text-muted);">No participants found in this event.</p></div>';
                return;
            }

            // Find current judge scores
            let existingScoresMap = {};
            if (statusData.success && statusData.data.judgeStatus) {
                const myStatus = statusData.data.judgeStatus.find(j => j.judgeId === currentUser.id);
                if (myStatus && myStatus.scores) {
                    myStatus.scores.forEach(s => {
                        existingScoresMap[s.participant_id] = s;
                    });
                }
            }

            renderScoringCards(pData.data, existingScoresMap);
        } catch (err) {
            console.error('Error loading evaluation cards:', err);
            showToast('Error loading event evaluation cards', 'error');
        }
    }

    // 6. Render Scoring Cards per Participant
    function renderScoringCards(participants, scoresMap) {
        scoringContainer.innerHTML = '';

        participants.forEach(p => {
            const score = scoresMap[p.id] || {
                performance: 0,
                creativity: 0,
                stage_presence: 0,
                technical_execution: 0,
                overall_impact: 0,
                total_score: 0,
                is_locked: 0
            };

            const isLocked = score.is_locked === 1;

            const card = document.createElement('div');
            card.className = 'card card-hover';
            card.style.marginBottom = '2rem';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div>
                        <h3 style="font-size: 1.35rem; color: var(--text-main);">${escapeHtml(p.name)}</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(p.description || '')}</p>
                    </div>
                    <div>
                        <span class="badge ${isLocked ? 'badge-locked' : (score.total_score > 0 ? 'badge-active' : 'badge-draft')}">
                            ${isLocked ? '🔒 Evaluation Locked' : (score.total_score > 0 ? 'Draft Saved' : 'Not Evaluated')}
                        </span>
                    </div>
                </div>

                <!-- 5 Scoring Categories Sliders/Inputs -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="form-group">
                        <label class="form-label">Performance (0–20)</label>
                        <input type="number" class="form-input score-input" data-cat="performance" data-pid="${p.id}" min="0" max="20" step="0.5" value="${score.performance}" ${isLocked ? 'disabled' : ''}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Creativity (0–20)</label>
                        <input type="number" class="form-input score-input" data-cat="creativity" data-pid="${p.id}" min="0" max="20" step="0.5" value="${score.creativity}" ${isLocked ? 'disabled' : ''}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Stage Presence (0–20)</label>
                        <input type="number" class="form-input score-input" data-cat="stage_presence" data-pid="${p.id}" min="0" max="20" step="0.5" value="${score.stage_presence}" ${isLocked ? 'disabled' : ''}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Technical Execution (0–20)</label>
                        <input type="number" class="form-input score-input" data-cat="technical_execution" data-pid="${p.id}" min="0" max="20" step="0.5" value="${score.technical_execution}" ${isLocked ? 'disabled' : ''}>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Overall Impact (0–20)</label>
                        <input type="number" class="form-input score-input" data-cat="overall_impact" data-pid="${p.id}" min="0" max="20" step="0.5" value="${score.overall_impact}" ${isLocked ? 'disabled' : ''}>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.6); padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--bg-card-border); flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <span style="color: var(--text-muted); font-size: 0.9rem;">Total Calculated Score:</span>
                        <span class="total-score-val" id="totalScore_${p.id}" style="font-size: 1.5rem; font-weight: 800; color: var(--accent-cyan); margin-left: 0.5rem;">
                            ${score.total_score.toFixed(1)} / 100
                        </span>
                    </div>

                    ${!isLocked ? `
                        <div style="display: flex; gap: 0.75rem;">
                            <button class="btn btn-secondary btn-sm save-draft-btn" data-pid="${p.id}">Save Draft</button>
                            <button class="btn btn-success btn-sm lock-score-btn" data-pid="${p.id}">Submit & Lock Evaluation</button>
                        </div>
                    ` : '<span style="font-size: 0.85rem; color: var(--text-dim);">Evaluation locked by judge</span>'}
                </div>
            `;

            scoringContainer.appendChild(card);
        });

        // Add Input Auto-Total Listeners
        document.querySelectorAll('.score-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const pid = e.target.dataset.pid;
                calculateTotalForParticipant(pid);
            });
        });

        // Add Submit Button Listeners
        document.querySelectorAll('.save-draft-btn').forEach(btn => {
            btn.addEventListener('click', (e) => submitScore(e.target.dataset.pid, false));
        });

        document.querySelectorAll('.lock-score-btn').forEach(btn => {
            btn.addEventListener('click', (e) => submitScore(e.target.dataset.pid, true));
        });
    }

    function calculateTotalForParticipant(pid) {
        const inputs = document.querySelectorAll(`.score-input[data-pid="${pid}"]`);
        let sum = 0;
        inputs.forEach(inp => {
            let val = parseFloat(inp.value) || 0;
            if (val > 20) { val = 20; inp.value = 20; }
            if (val < 0) { val = 0; inp.value = 0; }
            sum += val;
        });
        const totalEl = document.getElementById(`totalScore_${pid}`);
        if (totalEl) totalEl.textContent = `${sum.toFixed(1)} / 100`;
        return sum;
    }

    // 7. Submit Score API Call
    async function submitScore(participantId, lockEvaluation) {
        const inputs = document.querySelectorAll(`.score-input[data-pid="${participantId}"]`);
        const catValues = {};
        inputs.forEach(inp => {
            catValues[inp.dataset.cat] = parseFloat(inp.value) || 0;
        });

        if (lockEvaluation) {
            const confirmLock = confirm('Are you sure you want to submit and LOCK this score? Locked scores cannot be modified later.');
            if (!confirmLock) return;
        }

        try {
            const res = await fetch(`/api/events/${currentEventId}/judge-score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participant_id: parseInt(participantId, 10),
                    ...catValues,
                    lock_evaluation: lockEvaluation
                })
            });

            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Score saved successfully!', 'success');
                loadParticipantsAndScores(); // Refresh UI state
            } else {
                showToast(data.message || 'Failed to submit score', 'error');
            }
        } catch (err) {
            console.error('Error submitting score:', err);
            showToast('Network error submitting score', 'error');
        }
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }

    checkAuthStatus();
});
