const express = require('express');
const router = express.Router();
const { query } = require('../database/database');
const { requireAdmin } = require('../middleware/auth');
const { calculateEventResults } = require('../services/scoringService');

/**
 * GET /api/events/:id/results
 * Returns calculated normalized scores and ranking for an event.
 */
router.get('/:id/results', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const results = await calculateEventResults(eventId);

        return res.json({
            success: true,
            data: results
        });
    } catch (err) {
        console.error('Error calculating results:', err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Failed to calculate results'
        });
    }
});

/**
 * POST /api/events/:id/lock-results
 * Locks final event results (Admin only)
 */
router.post('/:id/lock-results', requireAdmin, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Lock event status
        await query.run('UPDATE events SET status = ? WHERE id = ?', ['results_locked', eventId]);

        // Lock all judge scores for this event
        await query.run('UPDATE judge_scores SET is_locked = 1 WHERE event_id = ?', [eventId]);

        const updatedResults = await calculateEventResults(eventId);

        return res.json({
            success: true,
            message: 'Event results locked successfully!',
            data: updatedResults
        });
    } catch (err) {
        console.error('Error locking results:', err);
        return res.status(500).json({ success: false, message: 'Failed to lock results' });
    }
});

module.exports = router;
