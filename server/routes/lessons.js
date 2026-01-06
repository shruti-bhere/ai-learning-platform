const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { cacheDelete } = require('../config/redis');

const router = express.Router();

// Update lesson progress
router.post('/:lessonId/progress', authenticate, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { progress_percentage, completed } = req.body;
    const userId = req.user.id;

    if (progress_percentage === undefined) {
      return res.status(400).json({ error: 'Progress percentage is required' });
    }

    const isCompleted = completed || progress_percentage === 100;
    const points = isCompleted ? 10 : 0;

    // Check if progress exists
    const existing = await pool.query(
      'SELECT id, completed FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
      [userId, lessonId]
    );

    if (existing.rows.length > 0) {
      // Update existing progress
      await pool.query(
        `UPDATE lesson_progress 
         SET progress_percentage = $1, completed = $2, 
         points_earned = $3, completed_at = $4, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $5 AND lesson_id = $6`,
        [
          progress_percentage,
          isCompleted,
          points,
          isCompleted ? new Date() : null,
          userId,
          lessonId
        ]
      );
    } else {
      // Create new progress
      await pool.query(
        `INSERT INTO lesson_progress (user_id, lesson_id, progress_percentage, completed, points_earned, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, lessonId, progress_percentage, isCompleted, points, isCompleted ? new Date() : null]
      );
    }

    // Update user points and currency
    if (points > 0 && isCompleted) {
      await pool.query(
        'UPDATE users SET total_points = total_points + $1, currency = currency + $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [points, points, userId]
      );
    }

    // Update streak
    await updateStreak(userId);

    // Update daily activity
    await updateDailyActivity(userId, points, isCompleted ? 1 : 0);

    // Clear cache
    await cacheDelete(`user:${userId}:progress`);
    await cacheDelete(`user:${userId}:profile`);

    res.json({ message: 'Progress updated successfully', points_earned: points });
  } catch (error) {
    console.error('Update lesson progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to update streak
async function updateStreak(userId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userResult = await pool.query(
      'SELECT last_activity_date, current_streak, longest_streak FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];
    const lastActivity = user.last_activity_date ? new Date(user.last_activity_date).toISOString().split('T')[0] : null;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let newStreak = user.current_streak || 0;

    if (lastActivity === today) {
      return;
    } else if (lastActivity === yesterday) {
      newStreak += 1;
    } else if (!lastActivity || lastActivity < yesterday) {
      newStreak = 1;
    }

    const longestStreak = Math.max(newStreak, user.longest_streak || 0);

    await pool.query(
      'UPDATE users SET current_streak = $1, longest_streak = $2, last_activity_date = $3 WHERE id = $4',
      [newStreak, longestStreak, today, userId]
    );
  } catch (error) {
    console.error('Update streak error:', error);
  }
}

// Helper function to update daily activity
async function updateDailyActivity(userId, points, lessonsCompleted) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const existing = await pool.query(
      'SELECT id FROM daily_activity WHERE user_id = $1 AND activity_date = $2',
      [userId, today]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE daily_activity 
         SET points_earned = points_earned + $1, 
         topics_completed = topics_completed + $2
         WHERE user_id = $3 AND activity_date = $4`,
        [points, lessonsCompleted, userId, today]
      );
    } else {
      await pool.query(
        `INSERT INTO daily_activity (user_id, activity_date, points_earned, topics_completed)
         VALUES ($1, $2, $3, $4)`,
        [userId, today, points, lessonsCompleted]
      );
    }
  } catch (error) {
    console.error('Update daily activity error:', error);
  }
}

module.exports = router;

