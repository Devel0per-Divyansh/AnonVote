const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../database/database');
const { requireAdmin, requireJudge } = require('../middleware/auth');

/**
 * POST /api/judges
 * Create new judge user (Admin only)
 */
router.post('/judges', requireAdmin, async (req, res) => {
    try {
        const { name, username, password } = req.body;

        if (!name || !username || !password) {
            return res.status(400).json({ success: false, message: 'Name, username, and password are required' });
        }

        const existing = await query.get('SELECT * FROM judges WHERE username = ?', [username.trim()]);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Judge username already exists' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const result = await query.run(
            'INSERT INTO judges (name, username, password_hash) VALUES (?, ?, ?)',
            [name.trim(), username.trim(), passwordHash]
        );

        return res.status(201).json({
            success: true,
            message: 'Judge created successfully',
            data: { id: result.id, name: name.trim(), username: username.trim() }
        });
    } catch (err) {
        console.error('Error creating judge:', err);
        return res.status(500).json({ success: false, message: 'Failed to create judge' });
    }
});

/**
 * GET /api/judges
 * List all judges (Admin or Judge)
 */
router.get('/judges', async (req, res) => {
    try {
        const judges = await query.all('SELECT id, name, username, created_at FROM judges ORDER BY id ASC');
        return res.json({ success: true, data: judges });
    } catch (err) {
        console.error('Error listing judges:', err);
        return res.status(500).json({ success: false, message: 'Failed to list judges' });
    }
});

/**
 * DELETE /api/judges/:id
 * Delete a judge (Admin only)
 */
router.delete('/judges/:id', requireAdmin, async (req, res) => {
    try {
        const judgeId = parseInt(req.params.id, 10);
        await query.run('DELETE FROM judges WHERE id = ?', [judgeId]);
        return res.json({ success: true, message: 'Judge deleted successfully' });
    } catch (err) {
        console.error('Error deleting judge:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete judge' });
    }
});

/**
 * GET /api/events/:id/judge-status
 * Check judge evaluation progress & submission status for an event.
 */
router.get('/events/:id/judge-status', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);

        const assignedJudges = await query.all(
            `SELECT j.id, j.name, j.username 
             FROM judges j 
             JOIN event_judges ej ON j.id = ej.judge_id 
             WHERE ej.event_id = ?`,
            [eventId]
        );

        const participants = await query.all(
            'SELECT id, name FROM participants WHERE event_id = ?',
            [eventId]
        );

        const scores = await query.all(
            'SELECT * FROM judge_scores WHERE event_id = ?',
            [eventId]
        );

        const judgeStatusMap = assignedJudges.map(judge => {
            const judgeScoresForEvent = scores.filter(s => s.judge_id === judge.id);
            const isCompleted = participants.length > 0 && judgeScoresForEvent.length === participants.length;
            const isLocked = judgeScoresForEvent.some(s => s.is_locked === 1);

            return {
                judgeId: judge.id,
                judgeName: judge.name,
                judgeUsername: judge.username,
                scoredCount: judgeScoresForEvent.length,
                totalParticipants: participants.length,
                isCompleted,
                isLocked,
                scores: judgeScoresForEvent
            };
        });

        return res.json({
            success: true,
            data: {
                eventId,
                totalAssignedJudges: assignedJudges.length,
                totalParticipants: participants.length,
                judgeStatus: judgeStatusMap
            }
        });
    } catch (err) {
        console.error('Error fetching judge status:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch judge status' });
    }
});

/**
 * POST /api/events/:id/judge-score
 * Submit or lock scores by an assigned judge.
 */
router.post('/events/:id/judge-score', requireJudge, async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const judgeId = req.session.user.id;
        const {
            participant_id,
            performance = 0,
            creativity = 0,
            stage_presence = 0,
            technical_execution = 0,
            overall_impact = 0,
            lock_evaluation = false
        } = req.body;

        if (!participant_id) {
            return res.status(400).json({ success: false, message: 'Participant ID is required' });
        }

        const participantId = parseInt(participant_id, 10);

        // 1. Verify Judge is assigned to this Event
        const assignment = await query.get(
            'SELECT * FROM event_judges WHERE event_id = ? AND judge_id = ?',
            [eventId, judgeId]
        );
        if (!assignment) {
            return res.status(403).json({ success: false, message: 'You are not assigned as a judge for this event' });
        }

        // 2. Validate Participant belongs to Event
        const participant = await query.get(
            'SELECT * FROM participants WHERE id = ? AND event_id = ?',
            [participantId, eventId]
        );
        if (!participant) {
            return res.status(400).json({ success: false, message: 'Invalid participant for this event' });
        }

        // 3. Check if evaluation is already locked for this judge & participant
        const existingScore = await query.get(
            'SELECT * FROM judge_scores WHERE event_id = ? AND judge_id = ? AND participant_id = ?',
            [eventId, judgeId, participantId]
        );

        if (existingScore && existingScore.is_locked === 1) {
            return res.status(400).json({
                success: false,
                message: 'Score is locked and cannot be modified after submission.'
            });
        }

        // 4. Validate category scores (0 to 20 each)
        const perf = Math.min(20, Math.max(0, parseFloat(performance) || 0));
        const crea = Math.min(20, Math.max(0, parseFloat(creativity) || 0));
        const stage = Math.min(20, Math.max(0, parseFloat(stage_presence) || 0));
        const tech = Math.min(20, Math.max(0, parseFloat(technical_execution) || 0));
        const impact = Math.min(20, Math.max(0, parseFloat(overall_impact) || 0));

        const totalScore = perf + crea + stage + tech + impact; // Out of 100 max
        const isLocked = lock_evaluation ? 1 : 0;

        if (existingScore) {
            await query.run(
                `UPDATE judge_scores 
                 SET performance = ?, creativity = ?, stage_presence = ?, technical_execution = ?, overall_impact = ?, total_score = ?, is_locked = ?, submitted_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [perf, crea, stage, tech, impact, totalScore, isLocked, existingScore.id]
            );
        } else {
            await query.run(
                `INSERT INTO judge_scores (event_id, participant_id, judge_id, performance, creativity, stage_presence, technical_execution, overall_impact, total_score, is_locked)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [eventId, participantId, judgeId, perf, crea, stage, tech, impact, totalScore, isLocked]
            );
        }

        return res.json({
            success: true,
            message: isLocked ? 'Score submitted and locked successfully!' : 'Draft score saved successfully',
            data: {
                eventId,
                participantId,
                totalScore,
                isLocked: !!isLocked
            }
        });
    } catch (err) {
        console.error('Error submitting judge score:', err);
        return res.status(500).json({ success: false, message: 'Failed to submit judge score' });
    }
});

module.exports = router;
