const assert = require('assert');
const http = require('http');
process.env.DB_PATH = ':memory:';
const app = require('../server');
const { seedDatabase, query } = require('../database/database');

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(baseUrl + path);
        const reqHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };

        const req = http.request(url, {
            method,
            headers: reqHeaders
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('\n========================================');
    console.log(' RUNNING ANONVOTE BACKEND INTEGRATION TESTS');
    console.log('========================================\n');

    await seedDatabase();

    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://localhost:${port}`;
            console.log(`Test server running on port ${port}`);
            resolve();
        });
    });

    let adminCookie = '';
    let judgeCookie = '';

    try {
        // 1. Test Admin Authentication
        console.log('Test 1: Admin Authentication');
        const adminRes = await request('POST', '/api/auth/admin/login', { username: 'admin', password: 'admin123' });
        assert.strictEqual(adminRes.status, 200, 'Admin login should return HTTP 200');
        assert.strictEqual(adminRes.body.success, true, 'Admin login should succeed');
        if (adminRes.headers['set-cookie']) {
            adminCookie = adminRes.headers['set-cookie'][0].split(';')[0];
        }
        console.log('   ✓ Admin login successful');

        const badAdmin = await request('POST', '/api/auth/admin/login', { username: 'admin', password: 'wrongpassword' });
        assert.strictEqual(badAdmin.status, 401, 'Bad admin password should fail with 401');
        console.log('   ✓ Invalid admin credentials correctly rejected');

        // 2. Test Judge Authentication
        console.log('\nTest 2: Judge Authentication');
        const judgeRes = await request('POST', '/api/auth/judge/login', { username: 'judge1', password: 'judge123' });
        assert.strictEqual(judgeRes.status, 200, 'Judge login should return HTTP 200');
        assert.strictEqual(judgeRes.body.success, true, 'Judge login should succeed');
        if (judgeRes.headers['set-cookie']) {
            judgeCookie = judgeRes.headers['set-cookie'][0].split(';')[0];
        }
        console.log('   ✓ Judge login successful');

        // 3. Test Event Creation (Admin)
        console.log('\nTest 3: Event Creation');
        const eventRes = await request('POST', '/api/events', {
            name: 'Battle of the Bands 2026',
            description: 'Rock & Metal Live Band Competition',
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 3600000).toISOString(),
            status: 'active'
        }, { Cookie: adminCookie });

        assert.strictEqual(eventRes.status, 201, 'Event creation should return HTTP 201');
        assert.strictEqual(eventRes.body.success, true);
        const testEventId = eventRes.body.data.id;
        console.log(`   ✓ Event created with ID: ${testEventId}`);

        // 4. Test Participant Creation (Admin)
        console.log('\nTest 4: Participant Creation');
        const p1Res = await request('POST', `/api/events/${testEventId}/participants`, {
            name: 'The Thunderbolts',
            description: 'Hard Rock Quartet'
        }, { Cookie: adminCookie });
        assert.strictEqual(p1Res.status, 201);
        const p1Id = p1Res.body.data.id;

        const p2Res = await request('POST', `/api/events/${testEventId}/participants`, {
            name: 'Neon Velocity',
            description: 'Electronic Synth Rock Band'
        }, { Cookie: adminCookie });
        assert.strictEqual(p2Res.status, 201);
        const p2Id = p2Res.body.data.id;

        // 4.5. Test Get All Judges & Assign Judges
        console.log('\nTest 4.5: Fetch Judges & Assign Judges to Event');
        const getJudgesRes = await request('GET', '/api/judges');
        assert.strictEqual(getJudgesRes.status, 200, 'GET /api/judges should return 200');
        assert.strictEqual(getJudgesRes.body.success, true);
        assert.ok(getJudgesRes.body.data.length >= 2, 'Should return at least 2 seeded judges');

        const assignRes = await request('POST', `/api/events/${testEventId}/judges`, { judge_ids: [1, 2] }, { Cookie: adminCookie });
        assert.strictEqual(assignRes.status, 200, 'Assign judges should return 200');
        console.log('   ✓ GET /api/judges and judge assignment successfully verified');

        // 5. Test Valid Audience Vote
        console.log('\nTest 5: Valid Audience Vote');
        const token1Header = { 'X-Device-Token': 'test_device_token_audience_001_secret' };
        const vote1Res = await request('POST', `/api/events/${testEventId}/vote`, { participant_id: p1Id }, token1Header);
        assert.strictEqual(vote1Res.status, 201, 'Audience vote should succeed with 201');
        assert.strictEqual(vote1Res.body.success, true);
        console.log('   ✓ Audience vote successfully recorded for P1');

        // 6. Test Duplicate Audience Vote Rejection
        console.log('\nTest 6: Duplicate Audience Vote Rejection');
        const dupVoteRes = await request('POST', `/api/events/${testEventId}/vote`, { participant_id: p2Id }, token1Header);
        assert.strictEqual(dupVoteRes.status, 409, 'Duplicate vote should be rejected with 409');
        assert.strictEqual(dupVoteRes.body.success, false);
        console.log('   ✓ Duplicate vote correctly rejected for same device token');

        // 7. Test Voting Outside Allowed Time / Closed Event
        console.log('\nTest 7: Voting Outside Allowed Time');
        // Create draft/closed event
        const closedEventRes = await request('POST', '/api/events', {
            name: 'Closed Fest',
            description: 'Test closed event',
            status: 'voting_closed'
        }, { Cookie: adminCookie });
        const closedEventId = closedEventRes.body.data.id;

        const closedVoteRes = await request('POST', `/api/events/${closedEventId}/vote`, { participant_id: 1 });
        assert.strictEqual(closedVoteRes.status, 400, 'Voting on closed event should return 400');
        console.log('   ✓ Vote on closed event correctly rejected');

        const closedResultsRes = await request('GET', `/api/events/${closedEventId}/results`);
        assert.strictEqual(closedResultsRes.status, 200, 'Results should remain viewable after voting closes');
        assert.strictEqual(closedResultsRes.body.success, true);
        assert.strictEqual(closedResultsRes.body.data.event.status, 'voting_closed');
        console.log('   ✓ Results remain available for voting-closed events');

        // 8. Test Invalid Participant Rejection
        console.log('\nTest 8: Invalid Participant Rejection');
        const invalidPRes = await request('POST', `/api/events/${testEventId}/vote`, { participant_id: 99999 });
        assert.strictEqual(invalidPRes.status, 400, 'Invalid participant should return 400');
        console.log('   ✓ Non-existent participant vote correctly rejected');

        // 9. Test Judge Score Submission
        console.log('\nTest 9: Judge Score Submission');
        const judgeScoreRes = await request('POST', `/api/events/${testEventId}/judge-score`, {
            participant_id: p1Id,
            performance: 18,
            creativity: 19,
            stage_presence: 17,
            technical_execution: 18,
            overall_impact: 19, // Total = 91/100
            lock_evaluation: true
        }, { Cookie: judgeCookie });
        assert.strictEqual(judgeScoreRes.status, 200, 'Judge score submission should return 200');
        assert.strictEqual(judgeScoreRes.body.data.totalScore, 91);
        console.log('   ✓ Judge score of 91/100 submitted and locked for P1');

        // 10. Test Final Score Calculation Formula
        console.log('\nTest 10: Final Score Calculation');
        // Add audience vote for P2 from another token so P1 has 1 vote (100%) and P2 has 0 votes (0%)
        const token2Header = { 'X-Device-Token': 'test_device_token_audience_002_secret' };
        await request('POST', `/api/events/${testEventId}/vote`, { participant_id: p2Id }, token2Header);

        const resultsRes = await request('GET', `/api/events/${testEventId}/results`);
        assert.strictEqual(resultsRes.status, 200);
        const rankings = resultsRes.body.data.rankings;
        assert.strictEqual(rankings.length, 2);

        // P1 Judge: 91, Audience: 1 vote / 1 max = 100% -> Final = (91 * 0.3333) + (100 * 0.6667) = 30.3303 + 66.67 = 97.00
        const p1Result = rankings.find(r => r.participantId === p1Id);
        assert.strictEqual(p1Result.judgeScore, 91);
        assert.strictEqual(p1Result.audienceScore, 100);
        assert.strictEqual(p1Result.finalScore, 97.00);

        console.log(`   ✓ Formula verified: P1 Judge=91.00, Audience=100.00 -> Final=${p1Result.finalScore}`);

        // 11. Test Ranking Generation
        console.log('\nTest 11: Ranking Generation');
        assert.strictEqual(rankings[0].participantId, p1Id, 'P1 should be Rank 1');
        assert.strictEqual(rankings[0].rank, 1);
        assert.strictEqual(rankings[1].rank, 2);
        console.log('   ✓ Ranking generation verified (Rank #1 P1, Rank #2 P2)');

        console.log('\n========================================');
        console.log(' ALL 11 BACKEND INTEGRATION TESTS PASSED!');
        console.log('========================================\n');

    } catch (err) {
        console.error('TEST FAILED:', err);
        process.exitCode = 1;
    } finally {
        if (server) {
            server.close();
        }
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
