document.addEventListener('DOMContentLoaded', async () => {
    let eventId = null;

    const eventSelect = document.getElementById('voteEventSelect');
    const eventNameEl = document.getElementById('eventName');
    const eventDescEl = document.getElementById('eventDescription');
    const statusBadgeEl = document.getElementById('eventStatusBadge');
    const toastContainer = document.getElementById('statusToastContainer');
    const participantListEl = document.getElementById('participantList');
    const submitVoteBtn = document.getElementById('submitVoteBtn');

    // Modal elements
    const confirmModal = document.getElementById('confirmModal');
    const modalParticipantName = document.getElementById('modalParticipantName');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelVoteBtn = document.getElementById('cancelVoteBtn');
    const confirmVoteBtn = document.getElementById('confirmVoteBtn');

    let selectedParticipantId = null;
    let selectedParticipantName = '';
    let participants = [];

    // Helper: Show toast notification
    function showToast(message, type = 'success') {
        toastContainer.innerHTML = `
            <div class="toast toast-${type}">
                <span>${type === 'success' ? '✅' : '⚠️'}</span>
                <span>${message}</span>
            </div>
        `;
    }

    // 1. Fetch Event Status & Participants
    async function loadEventData() {
        const requestedEventId = eventId;
        if (!requestedEventId) return;

        submitVoteBtn.disabled = true;
        submitVoteBtn.textContent = 'Select a Participant';
        submitVoteBtn.className = 'btn btn-primary btn-full';
        participantListEl.innerHTML = '<p style="color: var(--text-muted);">Loading participants...</p>';
        toastContainer.innerHTML = '';

        try {
            // Fetch status (including duplicate check for device token)
            const statusRes = await fetch(`/api/events/${requestedEventId}/voting-status`);
            const statusData = await statusRes.json();

            if (requestedEventId !== eventId) return;

            if (!statusData.success) {
                showToast(statusData.message || 'Failed to load event status', 'error');
                return;
            }

            const data = statusData.data;
            eventNameEl.textContent = data.eventName;
            eventDescEl.textContent = data.eventDescription || 'College Cultural Event Competition';

            // Update Badge
            if (data.isOpen) {
                statusBadgeEl.textContent = 'Voting Active';
                statusBadgeEl.className = 'badge badge-active';
            } else {
                statusBadgeEl.textContent = data.reason || 'Voting Closed';
                statusBadgeEl.className = 'badge badge-closed';
            }

            // Check if user has ALREADY voted
            if (data.hasVoted) {
                showToast('You have already submitted a vote for this event from this device.', 'success');
                submitVoteBtn.disabled = true;
                submitVoteBtn.textContent = 'Vote Already Recorded';
                submitVoteBtn.className = 'btn btn-secondary btn-full';
            }

            // Fetch Participants
            const pRes = await fetch(`/api/events/${requestedEventId}/participants`);
            const pData = await pRes.json();

            if (requestedEventId !== eventId) return;

            if (pData.success) {
                participants = pData.data;
                renderParticipants(participants, data.hasVoted, data.votedParticipantId, data.isOpen);
            }
        } catch (err) {
            if (requestedEventId !== eventId) return;
            console.error('Error loading voting page:', err);
            showToast('Network error loading event data', 'error');
        }
    }

    // 2. Render Participants List
    function renderParticipants(list, hasVoted, votedParticipantId, isOpen) {
        if (!list || list.length === 0) {
            participantListEl.innerHTML = '<p style="color: var(--text-muted);">No participants found for this event.</p>';
            return;
        }

        participantListEl.innerHTML = '';
        list.forEach(p => {
            const isVotedChoice = hasVoted && p.id === votedParticipantId;
            const card = document.createElement('div');
            card.className = `vote-card ${isVotedChoice ? 'selected' : ''}`;
            card.dataset.id = p.id;
            card.dataset.name = p.name;

            card.innerHTML = `
                <div class="radio-indicator"></div>
                <div class="participant-info">
                    <div class="participant-name">${escapeHtml(p.name)}</div>
                    <div class="participant-desc">${escapeHtml(p.description || '')}</div>
                </div>
                ${isVotedChoice ? '<span class="badge badge-active">Your Vote</span>' : ''}
            `;

            if (isOpen && !hasVoted) {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.vote-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    selectedParticipantId = p.id;
                    selectedParticipantName = p.name;
                    submitVoteBtn.disabled = false;
                    submitVoteBtn.textContent = `Submit Vote for ${p.name}`;
                    submitVoteBtn.className = 'btn btn-primary btn-full';
                });
            } else {
                card.style.cursor = 'default';
            }

            participantListEl.appendChild(card);
        });

        if (!isOpen && !hasVoted) {
            submitVoteBtn.disabled = true;
            submitVoteBtn.textContent = 'Voting is Currently Closed';
            submitVoteBtn.className = 'btn btn-secondary btn-full';
        }
    }

    // Modal Handlers
    submitVoteBtn.addEventListener('click', () => {
        if (!selectedParticipantId) return;
        modalParticipantName.textContent = selectedParticipantName;
        confirmModal.classList.add('active');
    });

    const hideModal = () => confirmModal.classList.remove('active');
    closeModalBtn.addEventListener('click', hideModal);
    cancelVoteBtn.addEventListener('click', hideModal);

    // 3. Confirm Vote Submission
    confirmVoteBtn.addEventListener('click', async () => {
        hideModal();
        submitVoteBtn.disabled = true;
        submitVoteBtn.textContent = 'Submitting Vote...';

        try {
            const res = await fetch(`/api/events/${eventId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participant_id: selectedParticipantId })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                showToast(data.message || 'Vote recorded successfully!', 'success');
                submitVoteBtn.textContent = 'Vote Recorded';
                submitVoteBtn.className = 'btn btn-success btn-full';
                loadEventData(); // Refresh UI state
            } else {
                showToast(data.message || 'Failed to record vote', 'error');
                submitVoteBtn.disabled = false;
                submitVoteBtn.textContent = `Submit Vote for ${selectedParticipantName}`;
            }
        } catch (err) {
            console.error('Error submitting vote:', err);
            showToast('Network error while submitting vote', 'error');
            submitVoteBtn.disabled = false;
        }
    });

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }

    eventSelect.addEventListener('change', () => {
        eventId = eventSelect.value;
        window.setSelectedEventInUrl(eventId);
        selectedParticipantId = null;
        selectedParticipantName = '';
        hideModal();
        loadEventData();
    });

    eventId = await window.populateEventSelector(eventSelect, { activeOnly: true });
    if (eventId) {
        loadEventData();
    } else {
        eventNameEl.textContent = 'No Active Events';
        eventDescEl.textContent = 'Audience voting is available when an event is active.';
        statusBadgeEl.textContent = 'Unavailable';
        statusBadgeEl.className = 'badge badge-closed';
        participantListEl.innerHTML = '<p style="color: var(--text-muted);">There are no active events to vote in right now.</p>';
        submitVoteBtn.disabled = true;
        submitVoteBtn.textContent = 'No Active Events';
    }
});
