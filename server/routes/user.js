const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { cacheGet, cacheSet, cacheDelete } = require('../config/redis');

const router = express.Router();

// Get user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const cacheKey = `user:${req.user.id}:profile`;
    const cached = await cacheGet(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const result = await pool.query(
      `SELECT id, username, email, currency, total_points, current_streak, 
       longest_streak, last_activity_date, created_at, is_admin 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    await cacheSet(cacheKey, user, 300); // Cache for 5 minutes

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { username } = req.body;

    if (username) {
      // Check if username is taken
      const existing = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, req.user.id]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      await pool.query(
        'UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [username, req.user.id]
      );
    }

    // Clear cache
    await cacheDelete(`user:${req.user.id}:profile`);

    const result = await pool.query(
      'SELECT id, username, email, currency, total_points, current_streak FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user currency
router.get('/currency', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT currency FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({ currency: result.rows[0].currency });
  } catch (error) {
    console.error('Get currency error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

