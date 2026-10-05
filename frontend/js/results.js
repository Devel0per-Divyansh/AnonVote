document.addEventListener('DOMContentLoaded', () => {
    let eventId = null;

    const eventSelect = document.getElementById('resultsEventSelect');
    const resultsStatusBadge = document.getElementById('resultsStatusBadge');
    const resultsEventName = document.getElementById('resultsEventName');
    const resultsEventDesc = document.getElementById('resultsEventDesc');
    const totalAudienceVotesVal = document.getElementById('totalAudienceVotesVal');
    const podiumSection = document.getElementById('podiumSection');
    const rankingsTableBody = document.getElementById('rankingsTableBody');
    const autoRefreshIndicator = document.getElementById('autoRefreshIndicator');

    let refreshTimer = null;

    async function loadResults() {
        const requestedEventId = eventId;
        if (!requestedEventId) return;

        try {
            const res = await fetch(`/api/events/${requestedEventId}/results`);
            const data = await res.json();

            if (requestedEventId !== eventId) return;

            if (!data.success) {
                resultsEventName.textContent = 'Event Not Found';
                return;
            }

            const rData = data.data;
            const event = rData.event;

            resultsEventName.textContent = event.name;
            resultsEventDesc.textContent = event.description || 'Cultural Competition';
            totalAudienceVotesVal.textContent = rData.totalAudienceVotes;

            const isLocked = event.status === 'results_locked';
            if (isLocked) {
                resultsStatusBadge.textContent = '🔒 Official Results Locked';
                resultsStatusBadge.className = 'badge badge-locked';
                autoRefreshIndicator.style.display = 'none';
                if (refreshTimer) clearInterval(refreshTimer);
            } else if (event.status === 'voting_closed') {
                resultsStatusBadge.textContent = 'Voting Closed — Results Available';
                resultsStatusBadge.className = 'badge badge-closed';
            } else {
                resultsStatusBadge.textContent = 'Live Standings';
                resultsStatusBadge.className = 'badge badge-active';
            }

            renderPodium(rData.rankings);
            renderTable(rData.rankings);
        } catch (err) {
            console.error('Error fetching results:', err);
        }
    }

    // 1. Render Top 3 Podium Cards
    function renderPodium(rankings) {
        if (!rankings || rankings.length === 0) {
            podiumSection.innerHTML = '';
            return;
        }

        const top3 = rankings.slice(0, 3);
        const rank1 = top3.find(r => r.rank === 1);
        const rank2 = top3.find(r => r.rank === 2);
        const rank3 = top3.find(r => r.rank === 3);

        let podiumHtml = '';

        if (rank2) {
            podiumHtml += `
                <div class="podium-card podium-rank-2">
                    <div class="podium-badge rank-2-badge">2</div>
                    <div class="podium-title">${escapeHtml(rank2.participantName)}</div>
                    <div class="podium-score">${rank2.finalScore.toFixed(2)}</div>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                        Judge: ${rank2.judgeScore.toFixed(2)} | Aud: ${rank2.audienceScore.toFixed(2)}
                    </p>
                </div>
            `;
        }

        if (rank1) {
            podiumHtml += `
                <div class="podium-card podium-rank-1">
                    <div class="podium-badge rank-1-badge">1</div>
                    <div style="font-size: 0.75rem; color: var(--accent-amber); font-weight: 700; text-transform: uppercase;">🏆 Champion</div>
                    <div class="podium-title" style="font-size: 1.35rem;">${escapeHtml(rank1.participantName)}</div>
                    <div class="podium-score" style="font-size: 2.2rem; color: var(--accent-amber);">${rank1.finalScore.toFixed(2)}</div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                        Judge: ${rank1.judgeScore.toFixed(2)} | Aud: ${rank1.audienceScore.toFixed(2)}
                    </p>
                </div>
            `;
        }

        if (rank3) {
            podiumHtml += `
                <div class="podium-card podium-rank-3">
                    <div class="podium-badge rank-3-badge">3</div>
                    <div class="podium-title">${escapeHtml(rank3.participantName)}</div>
                    <div class="podium-score">${rank3.finalScore.toFixed(2)}</div>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                        Judge: ${rank3.judgeScore.toFixed(2)} | Aud: ${rank3.audienceScore.toFixed(2)}
                    </p>
                </div>
            `;
        }

        podiumSection.innerHTML = podiumHtml;
    }

    // 2. Render Full Standings Table
    function renderTable(rankings) {
        if (!rankings || rankings.length === 0) {
            rankingsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No scores calculated yet.</td></tr>';
            return;
        }

        rankingsTableBody.innerHTML = rankings.map(r => `
            <tr style="${r.rank === 1 ? 'background: rgba(245, 158, 11, 0.05);' : ''}">
                <td>
                    <span class="badge ${r.rank === 1 ? 'badge-active' : 'badge-draft'}" style="${r.rank === 1 ? 'background: rgba(245, 158, 11, 0.2); color: var(--accent-amber); border-color: rgba(245, 158, 11, 0.4);' : ''}">
                        Rank #${r.rank}
                    </span>
                </td>
                <td>
                    <strong style="font-size: 1.05rem; color: var(--text-main);">${escapeHtml(r.participantName)}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(r.participantDescription || '')}</div>
                </td>
                <td><strong>${r.judgeScore.toFixed(2)}</strong> / 100</td>
                <td><strong>${r.audienceVotes}</strong> votes</td>
                <td><strong>${r.audienceScore.toFixed(2)}</strong> / 100</td>
                <td>
                    <span style="font-size: 1.25rem; font-weight: 800; color: var(--accent-cyan);">
                        ${r.finalScore.toFixed(2)}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }

    eventSelect.addEventListener('change', () => {
        eventId = eventSelect.value;
        window.setSelectedEventInUrl(eventId);
        if (refreshTimer) clearInterval(refreshTimer);
        loadResults();
        refreshTimer = setInterval(loadResults, 5000);
    });

    window.populateEventSelector(eventSelect, {
        statuses: ['active', 'voting_closed', 'results_locked']
    }).then(selectedEventId => {
        eventId = selectedEventId;
        if (!eventId) {
            resultsEventName.textContent = 'No Events Found';
            resultsEventDesc.textContent = 'Create an event from the admin dashboard to view its leaderboard.';
            podiumSection.innerHTML = '';
            rankingsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No events are available.</td></tr>';
            autoRefreshIndicator.style.display = 'none';
            return;
        }

        loadResults();
        refreshTimer = setInterval(loadResults, 5000);
    });
});
