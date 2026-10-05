const { query } = require('../database/database');

/**
 * Calculates normalized scores and ranking for an event.
 * Formula:
 *  - Judge Score (0-100): Average of total judge scores for participant
 *  - Audience Score (0-100): (participant_votes / highest_votes) * 100
 *  - Final Score = (Judge Score * 0.3333) + (Audience Score * 0.6667)
 */
async function calculateEventResults(eventId) {
    // 1. Fetch event
    const event = await query.get('SELECT * FROM events WHERE id = ?', [eventId]);
    if (!event) {
        throw new Error('Event not found');
    }

    // 2. Fetch all participants for this event
    const participants = await query.all(
        'SELECT id, name, description FROM participants WHERE event_id = ? ORDER BY id ASC',
        [eventId]
    );

    if (participants.length === 0) {
        return {
            event,
            totalAudienceVotes: 0,
            judgeEvaluationCount: 0,
            rankings: []
        };
    }

    // 3. Fetch audience votes grouped by participant
    const voteCounts = await query.all(
        `SELECT participant_id, COUNT(*) as vote_count 
         FROM audience_votes 
         WHERE event_id = ? 
         GROUP BY participant_id`,
        [eventId]
    );

    const voteMap = {};
    let totalAudienceVotes = 0;
    let highestVotes = 0;

    voteCounts.forEach(row => {
        const count = parseInt(row.vote_count, 10);
        voteMap[row.participant_id] = count;
        totalAudienceVotes += count;
        if (count > highestVotes) {
            highestVotes = count;
        }
    });

    // 4. Fetch judge scores for this event
    const judgeScores = await query.all(
        `SELECT participant_id, judge_id, total_score, performance, creativity, stage_presence, technical_execution, overall_impact
         FROM judge_scores 
         WHERE event_id = ?`,
        [eventId]
    );

    const judgeScoreMap = {};
    let totalJudgeSubmissions = judgeScores.length;

    judgeScores.forEach(score => {
        if (!judgeScoreMap[score.participant_id]) {
            judgeScoreMap[score.participant_id] = [];
        }
        judgeScoreMap[score.participant_id].push(score.total_score);
    });

    // 5. Calculate scores for each participant
    const results = participants.map(p => {
        const pVotes = voteMap[p.id] || 0;

        // Audience score calculation (0-100)
        let audienceScore = 0;
        if (highestVotes > 0) {
            audienceScore = (pVotes / highestVotes) * 100;
        }

        // Judge score calculation (0-100)
        const pJudgeScores = judgeScoreMap[p.id] || [];
        let averageJudgeScore = 0;
        if (pJudgeScores.length > 0) {
            const sum = pJudgeScores.reduce((acc, curr) => acc + curr, 0);
            averageJudgeScore = sum / pJudgeScores.length;
        }
        // Judge score normalized 0-100
        const normalizedJudgeScore = Math.min(100, Math.max(0, averageJudgeScore));

        // Combined Final Score
        const rawFinalScore = (normalizedJudgeScore * 0.3333) + (audienceScore * 0.6667);
        const finalScore = Math.round(rawFinalScore * 100) / 100;

        return {
            participantId: p.id,
            participantName: p.name,
            participantDescription: p.description,
            judgeScore: Math.round(normalizedJudgeScore * 100) / 100,
            judgeSubmissionsCount: pJudgeScores.length,
            audienceVotes: pVotes,
            audienceScore: Math.round(audienceScore * 100) / 100,
            finalScore: finalScore,
            rawFinalScore: rawFinalScore
        };
    });

    // 6. Sort results descending by rawFinalScore, with deterministic tie breaking
    results.sort((a, b) => {
        if (b.rawFinalScore !== a.rawFinalScore) {
            return b.rawFinalScore - a.rawFinalScore;
        }
        if (b.judgeScore !== a.judgeScore) {
            return b.judgeScore - a.judgeScore;
        }
        return a.participantId - b.participantId;
    });

    // Assign rank
    const rankings = results.map((item, index) => ({
        rank: index + 1,
        ...item
    }));

    return {
        event: {
            id: event.id,
            name: event.name,
            description: event.description,
            status: event.status,
            startTime: event.start_time,
            endTime: event.end_time
        },
        totalAudienceVotes,
        highestVotes,
        totalJudgeSubmissions,
        rankings
    };
}

module.exports = {
    calculateEventResults
};
