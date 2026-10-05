const express = require('express');
const router = express.Router();
const { query } = require('../database/database');
const { requireAdmin } = require('../middleware/auth');
const { generateEventQRCode } = require('../services/qrService');

/**
 * GET /api/events
 * List all events with participant & vote summary counts.
 */
router.get('/', async (req, res) => {
    try {
        const events = await query.all(`
            SELECT 
                e.id, e.name, e.description, e.start_time, e.end_time, e.status, e.created_at,
                (SELECT COUNT(*) FROM participants WHERE event_id = e.id) as participant_count,
                (SELECT COUNT(*) FROM audience_votes WHERE event_id = e.id) as total_votes,
                (SELECT COUNT(*) FROM event_judges WHERE event_id = e.id) as judge_count
            FROM events e
            ORDER BY e.id DESC
        `);

        return res.json({
            success: true,
            data: events
        });
    } catch (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch events' });
    }
});

/**
 * GET /api/events/:id
 * Fetch detailed event info with participants & judges.
 */
router.get('/:id', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const participants = await query.all(
            'SELECT * FROM participants WHERE event_id = ? ORDER BY id ASC',
            [eventId]
        );

        const judges = await query.all(
            `SELECT j.id, j.name, j.username 
             FROM judges j 
             JOIN event_judges ej ON j.id = ej.judge_id 
             WHERE ej.event_id = ?`,
            [eventId]
        );

        const voteCountRow = await query.get(
            'SELECT COUNT(*) as total_votes FROM audience_votes WHERE event_id = ?',
            [eventId]
        );

        return res.json({
            success: true,
            data: {
                ...event,
                total_votes: voteCountRow ? voteCountRow.total_votes : 0,
                participants,
                judges
            }
        });
    } catch (err) {
        console.error('Error fetching event details:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch event details' });
    }
});

/**
 * POST /api/events
 * Create new event (Admin only)
 */
router.post('/', requireAdmin, async (req, res) => {
    try {
        const { name, description, start_time, end_time, status } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Event name is required' });
        }

        const startTime = start_time || new Date().toISOString();
        const endTime = end_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const eventStatus = status || 'active';

        const result = await query.run(
            'INSERT INTO events (name, description, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), description ? description.trim() : '', startTime, endTime, eventStatus]
        );

        const newEvent = await query.get('SELECT * FROM events WHERE id = ?', [result.id]);

        return res.status(201).json({
            success: true,
            message: 'Event created successfully',
            data: newEvent
        });
    } catch (err) {
        console.error('Error creating event:', err);
        return res.status(500).json({ success: false, message: 'Failed to create event' });
    }
});

/**
 * PUT /api/events/:id
 * Update event details or status (Admin only)
 */
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const { name, description, start_time, end_time, status } = req.body;

        const existing = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const updatedName = name !== undefined ? name.trim() : existing.name;
        const updatedDesc = description !== undefined ? description.trim() : existing.description;
        const updatedStart = start_time !== undefined ? start_time : existing.start_time;
        const updatedEnd = end_time !== undefined ? end_time : existing.end_time;
        const updatedStatus = status !== undefined ? status : existing.status;

        if (status && !['draft', 'active', 'voting_closed', 'results_locked'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid event status' });
        }

        await query.run(
            'UPDATE events SET name = ?, description = ?, start_time = ?, end_time = ?, status = ? WHERE id = ?',
            [updatedName, updatedDesc, updatedStart, updatedEnd, updatedStatus, eventId]
        );

        const updatedEvent = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);

        return res.json({
            success: true,
            message: 'Event updated successfully',
            data: updatedEvent
        });
    } catch (err) {
        console.error('Error updating event:', err);
        return res.status(500).json({ success: false, message: 'Failed to update event' });
    }
});

/**
 * DELETE /api/events/:id
 * Delete event (Admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const existing = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        await query.run('DELETE FROM events WHERE id = ?', [eventId]);

        return res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting event:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
});

/**
 * POST /api/events/:id/participants
 * Add participant to event (Admin only)
 */
router.post('/:id/participants', requireAdmin, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Participant name is required' });
        }

        const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const result = await query.run(
            'INSERT INTO participants (event_id, name, description) VALUES (?, ?, ?)',
            [eventId, name.trim(), description ? description.trim() : '']
        );

        const participant = await query.get('SELECT * FROM participants WHERE id = ?', [result.id]);

        return res.status(201).json({
            success: true,
            message: 'Participant added successfully',
            data: participant
        });
    } catch (err) {
        console.error('Error adding participant:', err);
        return res.status(500).json({ success: false, message: 'Failed to add participant' });
    }
});

/**
 * GET /api/events/:id/participants
 */
router.get('/:id/participants', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const participants = await query.all(
            'SELECT * FROM participants WHERE event_id = ? ORDER BY id ASC',
            [eventId]
        );

        return res.json({
            success: true,
            data: participants
        });
    } catch (err) {
        console.error('Error fetching participants:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch participants' });
    }
});

/**
 * DELETE /api/events/:id/participants/:participantId
 * Delete participant (Admin only)
 */
router.delete('/:id/participants/:participantId', requireAdmin, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const participantId = parseInt(req.params.participantId, 10);

        const participant = await query.get(
            'SELECT * FROM participants WHERE id = ? AND event_id = ?',
            [participantId, eventId]
        );

        if (!participant) {
            return res.status(404).json({ success: false, message: 'Participant not found in this event' });
        }

        await query.run('DELETE FROM participants WHERE id = ?', [participantId]);

        return res.json({
            success: true,
            message: 'Participant deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting participant:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete participant' });
    }
});

/**
 * POST /api/events/:id/judges
 * Assign judge(s) to event (Admin only)
 */
router.post('/:id/judges', requireAdmin, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const { judge_ids } = req.body; // Array of judge IDs or single ID

        const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const judgeArray = Array.isArray(judge_ids) ? judge_ids : [judge_ids];

        for (const jId of judgeArray) {
            const judgeId = parseInt(jId, 10);
            if (judgeId) {
                await query.run(
                    'INSERT OR IGNORE INTO event_judges (event_id, judge_id) VALUES (?, ?)',
                    [eventId, judgeId]
                );
            }
        }

        return res.json({
            success: true,
            message: 'Judges assigned successfully'
        });
    } catch (err) {
        console.error('Error assigning judges:', err);
        return res.status(500).json({ success: false, message: 'Failed to assign judges' });
    }
});

/**
 * GET /api/events/:id/qr
 * Generate QR code for event voting page.
 */
router.get('/:id/qr', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        const qrData = await generateEventQRCode(eventId, baseUrl);

        return res.json({
            success: true,
            data: qrData
        });
    } catch (err) {
        console.error('Error generating event QR:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate QR code' });
    }
});

module.exports = router;
