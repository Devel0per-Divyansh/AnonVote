const express = require('express');
const router = express.Router();
const { query } = require('../database/database');
const { handleDeviceToken } = require('../middleware/deviceToken');
const { voteRateLimiter } = require('../middleware/rateLimiter');

/**
 * GET /api/events/:id/voting-status
 * Public endpoint: Checks if voting is active and whether current device has already voted.
 */
router.get('/:id/voting-status', handleDeviceToken, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const now = new Date();
        const startTime = new Date(event.start_time);
        const endTime = new Date(event.end_time);

        let isOpen = event.status === 'active';
        let reason = '';

        if (event.status !== 'active') {
            isOpen = false;
            if (event.status === 'draft') reason = 'Voting has not started yet.';
            else if (event.status === 'voting_closed') reason = 'Voting is closed for this event.';
            else if (event.status === 'results_locked') reason = 'Voting is closed and results are locked.';
        } else if (now < startTime) {
            isOpen = false;
            reason = 'Voting period has not started yet.';
        } else if (now > endTime) {
            isOpen = false;
            reason = 'Voting period has expired.';
        }

        // Check if device token has already voted in this event
        const existingVote = await query.get(
            'SELECT * FROM audience_votes WHERE event_id = ? AND anonymous_token_hash = ?',
            [eventId, req.deviceTokenHash]
        );

        return res.json({
            success: true,
            data: {
                eventId: event.id,
                eventName: event.name,
                eventDescription: event.description,
                status: event.status,
                isOpen,
                reason,
                hasVoted: !!existingVote,
                votedParticipantId: existingVote ? existingVote.participant_id : null,
                deviceToken: req.rawDeviceToken // Sent for optional client storage synchronization
            }
        });
    } catch (err) {
        console.error('Error fetching voting status:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch voting status' });
    }
});

/**
 * POST /api/events/:id/vote
 * Submit anonymous audience vote.
 */
router.post('/:id/vote', voteRateLimiter, handleDeviceToken, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const { participant_id } = req.body;

        if (!participant_id) {
            return res.status(400).json({ success: false, message: 'Participant selection is required' });
        }

        const participantId = parseInt(participant_id, 10);

        // 1. Check Event Existence & Status
        const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (event.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: `Voting is not active for this event (Status: ${event.status})`
            });
        }

        // 2. Validate Voting Window
        const now = new Date();
        const startTime = new Date(event.start_time);
        const endTime = new Date(event.end_time);

        if (now < startTime) {
            return res.status(400).json({ success: false, message: 'Voting has not started yet for this event' });
        }
        if (now > endTime) {
            return res.status(400).json({ success: false, message: 'Voting deadline has expired for this event' });
        }

        // 3. Validate Participant belongs to Event
        const participant = await query.get(
            'SELECT * FROM participants WHERE id = ? AND event_id = ?',
            [participantId, eventId]
        );
        if (!participant) {
            return res.status(400).json({ success: false, message: 'Selected participant is invalid for this event' });
        }

        // 4. Check for duplicate vote using anonymous token hash
        const existingVote = await query.get(
            'SELECT * FROM audience_votes WHERE event_id = ? AND anonymous_token_hash = ?',
            [eventId, req.deviceTokenHash]
        );

        if (existingVote) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate vote rejected: Your device has already submitted a vote for this event.'
            });
        }

        // 5. Store Vote
        const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
        await query.run(
            'INSERT INTO audience_votes (event_id, participant_id, anonymous_token_hash, ip_address) VALUES (?, ?, ?, ?)',
            [eventId, participantId, req.deviceTokenHash, ip]
        );

        return res.status(201).json({
            success: true,
            message: `Vote successfully recorded for ${participant.name}!`,
            data: {
                eventId,
                participantId: participant.id,
                participantName: participant.name
            }
        });
    } catch (err) {
        // Handle SQLite UNIQUE constraint error if concurrent votes happen
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
                success: false,
                message: 'Duplicate vote rejected: Your device has already submitted a vote for this event.'
            });
        }
        console.error('Error recording audience vote:', err);
        return res.status(500).json({ success: false, message: 'Failed to record vote' });
    }
});

module.exports = router;
