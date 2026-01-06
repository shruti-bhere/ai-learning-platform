const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { cacheGet, cacheSet, cacheDelete } = require('../config/redis');

const router = express.Router();

// Update progress
router.post('/update', authenticate, async (req, res) => {
  try {
    const { topic, progress_percentage, points_earned } = req.body;
    const userId = req.user.id;

    if (!topic || progress_percentage === undefined) {
      return res.status(400).json({ error: 'Topic and progress are required' });
    }

    // Check if progress exists
    const existing = await pool.query(
      'SELECT id, completed FROM user_progress WHERE user_id = $1 AND topic = $2',
      [userId, topic]
    );

    const isCompleted = progress_percentage === 100;
    const points = points_earned || (isCompleted ? 10 : 0);

    if (existing.rows.length > 0) {
      // Update existing progress
      await pool.query(
        `UPDATE user_progress 
         SET progress_percentage = $1, completed = $2, 
         points_earned = $3, completed_at = $4, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $5 AND topic = $6`,
        [
          progress_percentage,
          isCompleted,
          points,
          isCompleted ? new Date() : null,
          userId,
          topic
        ]
      );
    } else {
      // Create new progress
      await pool.query(
        `INSERT INTO user_progress (user_id, topic, progress_percentage, completed, points_earned, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, topic, progress_percentage, isCompleted, points, isCompleted ? new Date() : null]
      );
    }

    // Update user points and currency
    if (points > 0) {
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
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user progress (includes both topics and lessons)
router.get('/', authenticate, async (req, res) => {
  try {
    const cacheKey = `user:${req.user.id}:progress`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const userId = req.user.id;

    // Get topic progress
    const topicResult = await pool.query(
      `SELECT topic, progress_percentage, completed, points_earned, completed_at, updated_at
       FROM user_progress WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );

    // Get lesson progress with course and lesson details
    const lessonResult = await pool.query(
      `SELECT 
        lp.lesson_id,
        lp.progress_percentage,
        lp.completed,
        lp.points_earned,
        lp.completed_at,
        lp.updated_at,
        l.title as lesson_title,
        l.slug as lesson_slug,
        l.order_index,
        l.difficulty,
        c.id as course_id,
        c.name as course_name,
        c.slug as course_slug
       FROM lesson_progress lp
       JOIN lessons l ON lp.lesson_id = l.id
       JOIN courses c ON l.course_id = c.id
       WHERE lp.user_id = $1
       ORDER BY c.name, l.order_index`,
      [userId]
    );

    // Get course summary
    const courseSummaryResult = await pool.query(
      `SELECT 
        c.id,
        c.name,
        c.slug,
        COUNT(l.id) as total_lessons,
        COUNT(lp.id) as lessons_started,
        COUNT(CASE WHEN lp.completed = true THEN 1 END) as lessons_completed,
        COALESCE(SUM(lp.points_earned), 0) as course_points
       FROM courses c
       LEFT JOIN lessons l ON c.id = l.course_id
       LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = $1
       GROUP BY c.id, c.name, c.slug
       ORDER BY c.name`,
      [userId]
    );

    const progress = {
      topics: topicResult.rows,
      total_topics: topicResult.rows.length,
      completed_topics: topicResult.rows.filter(p => p.completed).length,
      lessons: lessonResult.rows,
      total_lessons: lessonResult.rows.length,
      completed_lessons: lessonResult.rows.filter(p => p.completed).length,
      courses: courseSummaryResult.rows,
      total_points: topicResult.rows.reduce((sum, p) => sum + (p.points_earned || 0), 0) +
                    lessonResult.rows.reduce((sum, p) => sum + (p.points_earned || 0), 0)
    };

    await cacheSet(cacheKey, progress, 300); // Cache for 5 minutes

    res.json(progress);
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get progress for specific topic
router.get('/:topic', authenticate, async (req, res) => {
  try {
    const { topic } = req.params;
    const result = await pool.query(
      'SELECT * FROM user_progress WHERE user_id = $1 AND topic = $2',
      [req.user.id, topic]
    );

    if (result.rows.length === 0) {
      return res.json({ topic, progress_percentage: 0, completed: false });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get topic progress error:', error);
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
      // Already updated today
      return;
    } else if (lastActivity === yesterday) {
      // Consecutive day
      newStreak += 1;
    } else if (!lastActivity || lastActivity < yesterday) {
      // Streak broken
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
async function updateDailyActivity(userId, points, topicsCompleted) {
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
        [points, topicsCompleted, userId, today]
      );
    } else {
      await pool.query(
        `INSERT INTO daily_activity (user_id, activity_date, points_earned, topics_completed)
         VALUES ($1, $2, $3, $4)`,
        [userId, today, points, topicsCompleted]
      );
    }
  } catch (error) {
    console.error('Update daily activity error:', error);
  }
}

module.exports = router;

