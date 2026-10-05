document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const adminDashboardSection = document.getElementById('adminDashboardSection');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminUsernameInput = document.getElementById('adminUsername');
    const adminPasswordInput = document.getElementById('adminPassword');
    const adminUserInfo = document.getElementById('adminUserInfo');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const loginToast = document.getElementById('loginToast');
    const toastContainer = document.getElementById('toastContainer');
    const eventListContainer = document.getElementById('eventListContainer');

    // Stats elements
    const statTotalEvents = document.getElementById('statTotalEvents');
    const statActiveEvents = document.getElementById('statActiveEvents');
    const statTotalVotes = document.getElementById('statTotalVotes');

    // Modals
    const createEventBtn = document.getElementById('createEventBtn');
    const eventModal = document.getElementById('eventModal');
    const closeEventModalBtn = document.getElementById('closeEventModalBtn');
    const cancelEventModalBtn = document.getElementById('cancelEventModalBtn');
    const eventForm = document.getElementById('eventForm');
    const editEventId = document.getElementById('editEventId');
    const eventNameInput = document.getElementById('eventNameInput');
    const eventDescInput = document.getElementById('eventDescInput');
    const eventStatusInput = document.getElementById('eventStatusInput');

    const participantModal = document.getElementById('participantModal');
    const closeParticipantModalBtn = document.getElementById('closeParticipantModalBtn');
    const participantModalEventName = document.getElementById('participantModalEventName');
    const addParticipantForm = document.getElementById('addParticipantForm');
    const pNameInput = document.getElementById('pNameInput');
    const pDescInput = document.getElementById('pDescInput');
    const participantTableBody = document.getElementById('participantTableBody');

    const judgeModal = document.getElementById('judgeModal');
    const closeJudgeModalBtn = document.getElementById('closeJudgeModalBtn');
    const judgeModalEventName = document.getElementById('judgeModalEventName');
    const assignJudgesForm = document.getElementById('assignJudgesForm');
    const judgeCheckboxContainer = document.getElementById('judgeCheckboxContainer');

    const addJudgeBtn = document.getElementById('addJudgeBtn');
    const createJudgeUserModal = document.getElementById('createJudgeUserModal');
    const closeCreateJudgeUserModalBtn = document.getElementById('closeCreateJudgeUserModalBtn');
    const createJudgeUserForm = document.getElementById('createJudgeUserForm');

    const qrModal = document.getElementById('qrModal');
    const closeQrModalBtn = document.getElementById('closeQrModalBtn');
    const qrImage = document.getElementById('qrImage');
    const qrTargetUrl = document.getElementById('qrTargetUrl');
    const copyQrUrlBtn = document.getElementById('copyQrUrlBtn');

    let currentUser = null;
    let activeEventId = null;

    window.quickFillAdmin = (username, password) => {
        adminUsernameInput.value = username;
        adminPasswordInput.value = password;
    };

    function showToast(msg, type = 'success', container = toastContainer) {
        container.innerHTML = `
            <div class="toast toast-${type}">
                <span>${type === 'success' ? '✅' : '⚠️'}</span>
                <span>${msg}</span>
            </div>
        `;
    }

    // 1. Auth Status Check
    async function checkAuthStatus() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();

            if (data.success && data.data.role === 'admin') {
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
        adminDashboardSection.style.display = 'none';
        adminUserInfo.textContent = '';
        adminLogoutBtn.style.display = 'none';
    }

    function showDashboard() {
        loginSection.style.display = 'none';
        adminDashboardSection.style.display = 'block';
        adminUserInfo.textContent = `⚙️ Admin: ${currentUser.username}`;
        adminLogoutBtn.style.display = 'inline-block';
        loadDashboardData();
    }

    // Login Form Submit
    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/auth/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: adminUsernameInput.value.trim(),
                    password: adminPasswordInput.value
                })
            });
            const data = await res.json();
            if (data.success) {
                currentUser = data.data;
                showDashboard();
            } else {
                showToast(data.message || 'Invalid admin credentials', 'error', loginToast);
            }
        } catch (err) {
            const isFileAccess = window.location.protocol === 'file:';
            if (isFileAccess) {
                showToast('Open the app from http://localhost:3000 before logging in', 'error', loginToast);
            } else {
                showToast('Network error logging in. Start the server with "npm start".', 'error', loginToast);
            }
        }
    });

    adminLogoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        showLogin();
    });

    // 2. Load Dashboard Data (Events & Summary Stats)
    async function loadDashboardData() {
        try {
            const res = await fetch('/api/events');
            const data = await res.json();

            if (!data.success) {
                showToast('Failed to load events', 'error');
                return;
            }

            const events = data.data;
            statTotalEvents.textContent = events.length;
            statActiveEvents.textContent = events.filter(e => e.status === 'active').length;
            const totalVotes = events.reduce((acc, e) => acc + (e.total_votes || 0), 0);
            statTotalVotes.textContent = totalVotes;

            renderEvents(events);
        } catch (err) {
            console.error('Error loading dashboard data:', err);
            showToast('Network error loading dashboard', 'error');
        }
    }

    // 3. Render Events List Cards
    function renderEvents(events) {
        if (!events || events.length === 0) {
            eventListContainer.innerHTML = '<div class="card"><p style="color: var(--text-muted);">No events found. Click "+ Create New Event" to get started.</p></div>';
            return;
        }

        eventListContainer.innerHTML = '';
        events.forEach(ev => {
            const card = document.createElement('div');
            card.className = 'card card-hover';

            let badgeClass = 'badge-draft';
            if (ev.status === 'active') badgeClass = 'badge-active';
            if (ev.status === 'voting_closed') badgeClass = 'badge-closed';
            if (ev.status === 'results_locked') badgeClass = 'badge-locked';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <span class="badge ${badgeClass}">${ev.status.replace('_', ' ')}</span>
                        <h3 style="margin-top: 0.5rem; font-size: 1.3rem;">${escapeHtml(ev.name)}</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem;">${escapeHtml(ev.description || '')}</p>
                    </div>

                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm edit-event-btn" data-id="${ev.id}">Edit Event</button>
                        <button class="btn btn-danger btn-sm delete-event-btn" data-id="${ev.id}">Delete</button>
                    </div>
                </div>

                <div style="display: flex; gap: 1.5rem; border-top: 1px solid var(--bg-card-border); border-bottom: 1px solid var(--bg-card-border); padding: 0.75rem 0; margin-bottom: 1rem; font-size: 0.875rem; color: var(--text-muted); flex-wrap: wrap;">
                    <span>👥 <strong>${ev.participant_count || 0}</strong> Participants</span>
                    <span>👨‍⚖️ <strong>${ev.judge_count || 0}</strong> Judges Assigned</span>
                    <span>🗳️ <strong>${ev.total_votes || 0}</strong> Total Audience Votes</span>
                </div>

                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; justify-content: space-between;">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-sm open-qr-btn" data-id="${ev.id}" data-name="${escapeHtml(ev.name)}">📷 Show QR Code</button>
                        <button class="btn btn-secondary btn-sm manage-participants-btn" data-id="${ev.id}" data-name="${escapeHtml(ev.name)}">Participants (${ev.participant_count || 0})</button>
                        <button class="btn btn-secondary btn-sm assign-judges-btn" data-id="${ev.id}" data-name="${escapeHtml(ev.name)}">Assign Judges</button>
                    </div>

                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${ev.status === 'active' ? `
                            <button class="btn btn-secondary btn-sm toggle-voting-btn" data-id="${ev.id}" data-status="voting_closed">Stop Voting</button>
                        ` : (ev.status === 'voting_closed' || ev.status === 'draft' ? `
                            <button class="btn btn-success btn-sm toggle-voting-btn" data-id="${ev.id}" data-status="active">Start Voting</button>
                        ` : '')}

                        ${ev.status !== 'results_locked' ? `
                            <button class="btn btn-success btn-sm lock-results-btn" data-id="${ev.id}">🔒 Lock Results</button>
                        ` : ''}

                        <a href="results.html?event=${ev.id}" class="btn btn-secondary btn-sm" target="_blank">View Leaderboard ↗</a>
                    </div>
                </div>
            `;

            eventListContainer.appendChild(card);
        });

        // Add event listeners
        document.querySelectorAll('.edit-event-btn').forEach(b => b.addEventListener('click', (e) => openEditEventModal(e.target.dataset.id)));
        document.querySelectorAll('.delete-event-btn').forEach(b => b.addEventListener('click', (e) => deleteEvent(e.target.dataset.id)));
        document.querySelectorAll('.open-qr-btn').forEach(b => b.addEventListener('click', (e) => openQrModal(e.target.dataset.id, e.target.dataset.name)));
        document.querySelectorAll('.manage-participants-btn').forEach(b => b.addEventListener('click', (e) => openParticipantsModal(e.target.dataset.id, e.target.dataset.name)));
        document.querySelectorAll('.assign-judges-btn').forEach(b => b.addEventListener('click', (e) => openAssignJudgesModal(e.target.dataset.id, e.target.dataset.name)));
        document.querySelectorAll('.toggle-voting-btn').forEach(b => b.addEventListener('click', (e) => toggleVotingStatus(e.target.dataset.id, e.target.dataset.status)));
        document.querySelectorAll('.lock-results-btn').forEach(b => b.addEventListener('click', (e) => lockResults(e.target.dataset.id)));
    }

    // Modal helpers
    const showModal = (el) => el.classList.add('active');
    const hideModal = (el) => el.classList.remove('active');

    // Event Modal
    createEventBtn.addEventListener('click', () => {
        editEventId.value = '';
        document.getElementById('eventModalTitle').textContent = 'Create Cultural Event';
        eventForm.reset();
        showModal(eventModal);
    });

    closeEventModalBtn.addEventListener('click', () => hideModal(eventModal));
    cancelEventModalBtn.addEventListener('click', () => hideModal(eventModal));

    async function openEditEventModal(id) {
        try {
            const res = await fetch(`/api/events/${id}`);
            const data = await res.json();
            if (data.success) {
                const ev = data.data;
                editEventId.value = ev.id;
                eventNameInput.value = ev.name;
                eventDescInput.value = ev.description || '';
                eventStatusInput.value = ev.status;
                document.getElementById('eventModalTitle').textContent = 'Edit Event';
                showModal(eventModal);
            }
        } catch (err) {
            showToast('Error loading event details', 'error');
        }
    }

    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editEventId.value;
        const payload = {
            name: eventNameInput.value,
            description: eventDescInput.value,
            status: eventStatusInput.value
        };

        const url = id ? `/api/events/${id}` : '/api/events';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                hideModal(eventModal);
                showToast(id ? 'Event updated!' : 'Event created!', 'success');
                loadDashboardData();
            } else {
                showToast(data.message || 'Operation failed', 'error');
            }
        } catch (err) {
            showToast('Network error saving event', 'error');
        }
    });

    async function deleteEvent(id) {
        if (!confirm('Are you sure you want to delete this event and all associated scores/votes?')) return;
        try {
            const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showToast('Event deleted successfully', 'success');
                loadDashboardData();
            }
        } catch (err) {
            showToast('Error deleting event', 'error');
        }
    }

    async function toggleVotingStatus(id, newStatus) {
        try {
            const res = await fetch(`/api/events/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Voting status changed to: ${newStatus}`, 'success');
                loadDashboardData();
            }
        } catch (err) {
            showToast('Failed to update voting status', 'error');
        }
    }

    async function lockResults(id) {
        if (!confirm('Lock results for this event? Once locked, judge evaluations and audience votes are finalized.')) return;
        try {
            const res = await fetch(`/api/events/${id}/lock-results`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showToast('Event results locked successfully!', 'success');
                loadDashboardData();
            }
        } catch (err) {
            showToast('Failed to lock results', 'error');
        }
    }

    // QR Code Modal
    async function openQrModal(id, name) {
        activeEventId = id;
        document.getElementById('qrModalEventName').textContent = name;
        try {
            const res = await fetch(`/api/events/${id}/qr`);
            const data = await res.json();
            if (data.success) {
                qrImage.src = data.data.qrDataUrl;
                qrTargetUrl.textContent = data.data.url;
                showModal(qrModal);
            }
        } catch (err) {
            showToast('Failed to load QR code', 'error');
        }
    }
    closeQrModalBtn.addEventListener('click', () => hideModal(qrModal));
    copyQrUrlBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(qrTargetUrl.textContent);
        showToast('Voting URL copied to clipboard!', 'success');
    });

    // Participant Modal
    async function openParticipantsModal(id, name) {
        activeEventId = id;
        participantModalEventName.textContent = name;
        loadParticipants(id);
        showModal(participantModal);
    }
    closeParticipantModalBtn.addEventListener('click', () => hideModal(participantModal));

    async function loadParticipants(eventId) {
        try {
            const res = await fetch(`/api/events/${eventId}/participants`);
            const data = await res.json();
            if (data.success) {
                participantTableBody.innerHTML = data.data.map(p => `
                    <tr>
                        <td>#${p.id}</td>
                        <td><strong>${escapeHtml(p.name)}</strong></td>
                        <td>${escapeHtml(p.description || '')}</td>
                        <td>
                            <button class="btn btn-danger btn-sm remove-p-btn" data-pid="${p.id}">Remove</button>
                        </td>
                    </tr>
                `).join('') || '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No participants added yet.</td></tr>';

                document.querySelectorAll('.remove-p-btn').forEach(b => {
                    b.addEventListener('click', (e) => removeParticipant(eventId, e.target.dataset.pid));
                });
            }
        } catch (err) {
            showToast('Error loading participants', 'error');
        }
    }

    addParticipantForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/events/${activeEventId}/participants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: pNameInput.value,
                    description: pDescInput.value
                })
            });
            const data = await res.json();
            if (data.success) {
                pNameInput.value = '';
                pDescInput.value = '';
                loadParticipants(activeEventId);
                loadDashboardData();
            }
        } catch (err) {
            showToast('Failed to add participant', 'error');
        }
    });

    async function removeParticipant(eventId, participantId) {
        if (!confirm('Remove this participant?')) return;
        try {
            const res = await fetch(`/api/events/${eventId}/participants/${participantId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadParticipants(eventId);
                loadDashboardData();
            }
        } catch (err) {
            showToast('Failed to remove participant', 'error');
        }
    }

    // Assign Judges Modal
    async function openAssignJudgesModal(eventId, eventName) {
        activeEventId = eventId;
        judgeModalEventName.textContent = eventName;
        try {
            const [allJudgesRes, eventRes] = await Promise.all([
                fetch('/api/judges'),
                fetch(`/api/events/${eventId}`)
            ]);
            const jData = await allJudgesRes.json();
            const eData = await eventRes.json();

            if (jData.success && eData.success) {
                const assignedIds = (eData.data.judges || []).map(j => j.id);

                judgeCheckboxContainer.innerHTML = jData.data.map(j => `
                    <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid var(--bg-card-border); cursor: pointer;">
                        <input type="checkbox" value="${j.id}" ${assignedIds.includes(j.id) ? 'checked' : ''} style="width: 18px; height: 18px;">
                        <span><strong>${escapeHtml(j.name)}</strong> (@${escapeHtml(j.username)})</span>
                    </label>
                `).join('') || '<p style="color: var(--text-muted);">No judges found. Add a judge first.</p>';

                showModal(judgeModal);
            }
        } catch (err) {
            showToast('Error loading judge assignments', 'error');
        }
    }
    closeJudgeModalBtn.addEventListener('click', () => hideModal(judgeModal));

    assignJudgesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const checkboxes = judgeCheckboxContainer.querySelectorAll('input[type="checkbox"]:checked');
        const selectedJudgeIds = Array.from(checkboxes).map(c => parseInt(c.value, 10));

        try {
            const res = await fetch(`/api/events/${activeEventId}/judges`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ judge_ids: selectedJudgeIds })
            });
            const data = await res.json();
            if (data.success) {
                hideModal(judgeModal);
                showToast('Judge assignments saved!', 'success');
                loadDashboardData();
            }
        } catch (err) {
            showToast('Error saving judge assignments', 'error');
        }
    });

    // Create New Judge User Modal
    addJudgeBtn.addEventListener('click', () => showModal(createJudgeUserModal));
    closeCreateJudgeUserModalBtn.addEventListener('click', () => hideModal(createJudgeUserModal));

    createJudgeUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/judges', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('newJudgeName').value,
                    username: document.getElementById('newJudgeUsername').value,
                    password: document.getElementById('newJudgePassword').value
                })
            });
            const data = await res.json();
            if (data.success) {
                hideModal(createJudgeUserModal);
                createJudgeUserForm.reset();
                showToast('New judge created successfully!', 'success');
            } else {
                showToast(data.message || 'Failed to create judge', 'error');
            }
        } catch (err) {
            showToast('Network error creating judge', 'error');
        }
    });

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }

    checkAuthStatus();
});
