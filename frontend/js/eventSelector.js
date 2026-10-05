window.setSelectedEventInUrl = function (eventId) {
    const params = new URLSearchParams(window.location.search);
    params.set('event', eventId);
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
};

function formatEventStatus(status) {
    const labels = {
        draft: 'Draft',
        active: 'Active',
        voting_closed: 'Voting Closed',
        results_locked: 'Results Locked'
    };

    return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

window.populateEventSelector = async function (select, { activeOnly = false, statuses = null } = {}) {
    select.innerHTML = '<option value="">Loading events...</option>';

    try {
        const response = await fetch('/api/events');
        const result = await response.json();

        if (!response.ok || !result.success || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Failed to load events');
        }

        const events = activeOnly
            ? result.data.filter(event => event.status === 'active')
            : statuses
                ? result.data.filter(event => statuses.includes(event.status))
                : result.data;

        if (events.length === 0) {
            select.innerHTML = `<option value="">No ${activeOnly ? 'active ' : ''}events found</option>`;
            select.disabled = true;
            return null;
        }

        select.disabled = false;
        select.replaceChildren();
        events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = `${event.name} (${formatEventStatus(event.status)})`;
            select.appendChild(option);
        });

        const params = new URLSearchParams(window.location.search);
        const requestedEventId = params.get('event');
        const selectedEvent = events.find(event => String(event.id) === requestedEventId)
            || events.find(event => event.status === 'active')
            || events[0];

        select.value = String(selectedEvent.id);
        if (requestedEventId !== String(selectedEvent.id)) {
            window.setSelectedEventInUrl(selectedEvent.id);
        }

        return String(selectedEvent.id);
    } catch (error) {
        console.error('Error loading event selector:', error);
        select.innerHTML = '<option value="">Unable to load events</option>';
        select.disabled = true;
        return null;
    }
};
