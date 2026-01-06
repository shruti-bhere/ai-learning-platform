const express = require('express');
const { pool } = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');

const router = express.Router();

// Get leaderboard
router.get('/', async (req, res) => {
  try {
    const { type = 'all', limit = 100 } = req.query;
    const cacheKey = `leaderboard:${type}:${limit}`;
    
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let query;
    if (type === 'streak') {
      query = `
        SELECT id, username, current_streak as score, longest_streak, total_points
        FROM users
        WHERE current_streak > 0
        ORDER BY current_streak DESC, total_points DESC
        LIMIT $1
      `;
    } else if (type === 'points') {
      query = `
        SELECT id, username, total_points as score, current_streak, currency
        FROM users
        ORDER BY total_points DESC
        LIMIT $1
      `;
    } else {
      // Combined ranking based on points and streak
      query = `
        SELECT id, username, 
               (total_points + (current_streak * 10)) as score,
               total_points, current_streak, longest_streak, currency
        FROM users
        ORDER BY score DESC
        LIMIT $1
      `;
    }

    const result = await pool.query(query, [limit]);

    // Add rank
    const leaderboard = result.rows.map((user, index) => ({
      rank: index + 1,
      ...user
    }));

    await cacheSet(cacheKey, leaderboard, 300); // Cache for 5 minutes

    res.json({ leaderboard, type });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user rank
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's total score
    const userResult = await pool.query(
      `SELECT id, username, total_points, current_streak 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const userScore = user.total_points + (user.current_streak * 10);

    // Count users with higher score
    const rankResult = await pool.query(
      `SELECT COUNT(*) as rank
       FROM users
       WHERE (total_points + (COALESCE(current_streak, 0) * 10)) > $1`,
      [userScore]
    );

    const rank = parseInt(rankResult.rows[0].rank) + 1;

    res.json({
      user_id: parseInt(userId),
      username: user.username,
      rank,
      total_points: user.total_points,
      current_streak: user.current_streak,
      score: userScore
    });
  } catch (error) {
    console.error('Get user rank error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

