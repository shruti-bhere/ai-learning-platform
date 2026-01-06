const express = require('express');
const { pool } = require('../config/database');
const { authenticate, isAdmin } = require('../middleware/auth');
const { getActiveUsersCount, getActiveUsersList } = require('../middleware/activeUsers');
const { cacheGet, cacheSet, cacheDeletePattern } = require('../config/redis');
const { generateLessonContent } = require('../services/contentGeneration');

const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(authenticate);
router.use(isAdmin);

// Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const cacheKey = 'admin:dashboard';
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Total users
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    // Monthly users (users active in last 30 days)
    const monthlyUsersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM daily_activity 
       WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days'`
    );
    const monthlyUsers = parseInt(monthlyUsersResult.rows[0].count);

    // Daily active users (today)
    const today = new Date().toISOString().split('T')[0];
    const dailyUsersResult = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM daily_activity 
       WHERE activity_date = $1`,
      [today]
    );
    const dailyUsers = parseInt(dailyUsersResult.rows[0].count);

    // Live active users (from Redis)
    const liveUsers = await getActiveUsersCount();

    // Daily activity data for last 30 days
    const activityDataResult = await pool.query(
      `SELECT activity_date, 
       COUNT(DISTINCT user_id) as active_users,
       SUM(points_earned) as total_points,
       SUM(topics_completed) as total_topics
       FROM daily_activity
       WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY activity_date
       ORDER BY activity_date DESC`
    );

    const dashboard = {
      total_users: totalUsers,
      monthly_users: monthlyUsers,
      daily_users: dailyUsers,
      live_users: liveUsers,
      activity_data: activityDataResult.rows
    };

    await cacheSet(cacheKey, dashboard, 60); // Cache for 1 minute

    res.json(dashboard);
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT id, username, email, currency, total_points, current_streak, 
       longest_streak, created_at 
       FROM users 
       ORDER BY total_points DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily activity details (per user for a given date)
router.get('/activity/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT u.username, u.email, da.points_earned, da.topics_completed, da.time_spent_minutes
       FROM daily_activity da
       JOIN users u ON da.user_id = u.id
       WHERE da.activity_date = $1
       ORDER BY da.points_earned DESC`,
      [targetDate]
    );

    res.json({
      date: targetDate,
      activities: result.rows
    });
  } catch (error) {
    console.error('Get daily activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get currently active users (without login/logout tracking)
router.get('/users/active', async (req, res) => {
  try {
    // Get active user IDs from Redis
    const activeUserIds = await getActiveUsersList();
    
    if (activeUserIds.length === 0) {
      return res.json({
        active_users: [],
        count: 0,
        message: 'No users currently active (or Redis not available)'
      });
    }
    
    // Get user details from database
    const userIds = activeUserIds.map(u => u.userId);
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
    
    const result = await pool.query(
      `SELECT 
         u.id,
         u.username,
         u.email,
         u.total_points,
         u.current_streak,
         u.last_activity_date,
         u.created_at
       FROM users u
       WHERE u.id IN (${placeholders})
       ORDER BY u.username`,
      userIds
    );
    
    // Combine with last active timestamp from Redis
    const activeUsers = result.rows.map(user => {
      const activeData = activeUserIds.find(a => a.userId === user.id);
      return {
        ...user,
        last_active_timestamp: activeData ? activeData.lastActive : null
      };
    });
    
    res.json({
      active_users: activeUsers,
      count: activeUsers.length,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Get active users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recently active users (based on last_activity_date, no login/logout needed)
router.get('/users/recently-active', async (req, res) => {
  try {
    const { hours = 24, limit = 50 } = req.query;
    
    const result = await pool.query(
      `SELECT 
         u.id,
         u.username,
         u.email,
         u.total_points,
         u.current_streak,
         u.last_activity_date,
         u.created_at,
         COALESCE(da.points_earned, 0) as today_points,
         COALESCE(da.topics_completed, 0) as today_topics_completed
       FROM users u
       LEFT JOIN daily_activity da ON u.id = da.user_id 
         AND da.activity_date = CURRENT_DATE
       WHERE u.last_activity_date >= CURRENT_DATE - INTERVAL '${parseInt(hours)} hours'
       ORDER BY u.last_activity_date DESC
       LIMIT $1`,
      [parseInt(limit)]
    );
    
    res.json({
      recently_active_users: result.rows,
      count: result.rows.length,
      time_window_hours: parseInt(hours)
    });
  } catch (error) {
    console.error('Get recently active users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent login/logout sessions with time spent
router.get('/sessions/recent', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const result = await pool.query(
      `SELECT 
         us.id,
         u.username,
         u.email,
         us.session_start,
         us.session_end,
         us.is_active,
         EXTRACT(EPOCH FROM (COALESCE(us.session_end, NOW()) - us.session_start)) / 60 AS duration_minutes
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       ORDER BY us.session_start DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      sessions: result.rows
    });
  } catch (error) {
    console.error('Get recent sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all lessons (for admin to view/edit)
router.get('/lessons', async (req, res) => {
  try {
    const { courseSlug } = req.query;
    
    let query = `
      SELECT l.id, l.title, l.slug, l.order_index, l.difficulty, l.content, l.estimated_time, l.code_example, l.code_language,
             c.name as course_name, c.slug as course_slug
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
    `;
    const params = [];
    
    if (courseSlug) {
      query += ' WHERE c.slug = $1';
      params.push(courseSlug);
    }
    
    query += ' ORDER BY c.name, l.order_index';
    
    const result = await pool.query(query, params);
    
    res.json({
      lessons: result.rows
    });
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update lesson content
router.put('/lessons/:lessonId', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { content, title, difficulty, estimated_time, code_example, code_language, order_index } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const updateFields = ['content = $1'];
    const values = [content];
    let paramIndex = 2;
    
    if (title) {
      updateFields.push(`title = $${paramIndex}`);
      values.push(title);
      paramIndex++;
    }
    
    if (difficulty) {
      updateFields.push(`difficulty = $${paramIndex}`);
      values.push(difficulty);
      paramIndex++;
    }
    
    if (estimated_time !== undefined) {
      updateFields.push(`estimated_time = $${paramIndex}`);
      values.push(estimated_time);
      paramIndex++;
    }
    
    if (order_index !== undefined) {
      updateFields.push(`order_index = $${paramIndex}`);
      values.push(order_index);
      paramIndex++;
    }
    
    if (code_example !== undefined) {
      updateFields.push(`code_example = $${paramIndex}`);
      values.push(code_example);
      paramIndex++;
    }
    
    if (code_language !== undefined) {
      updateFields.push(`code_language = $${paramIndex}`);
      values.push(code_language);
      paramIndex++;
    }
    
    values.push(lessonId);
    
    const result = await pool.query(
      `UPDATE lessons 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, title, slug, content, difficulty, estimated_time, code_example, code_language, order_index`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    
    // Clear cache
    await cacheDeletePattern('admin:*');
    
    res.json({
      message: 'Lesson updated successfully',
      lesson: result.rows[0]
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new course
router.post('/courses', async (req, res) => {
  try {
    const { name, slug, description, icon } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Course name is required' });
    }

    const normalizedSlug =
      slug ||
      name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    const result = await pool.query(
      `INSERT INTO courses (name, slug, description, icon)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, slug, description, icon, created_at`,
      [name, normalizedSlug, description || null, icon || null]
    );

    // Invalidate course-related caches
    await cacheDeletePattern('courses:*');
    await cacheDeletePattern('course:*');

    res.status(201).json({
      message: 'Course created successfully',
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Create course error:', error);
    if (error.code === '23505') {
      // unique_violation
      return res.status(400).json({ error: 'Course with this name or slug already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an existing course
router.put('/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { name, slug, description, icon } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (name) {
      fields.push(`name = $${idx}`);
      values.push(name);
      idx += 1;
    }

    if (slug) {
      fields.push(`slug = $${idx}`);
      values.push(
        slug
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
      );
      idx += 1;
    } else if (name) {
      // If slug not provided but name is updated, regenerate slug from name
      fields.push(`slug = $${idx}`);
      values.push(
        name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
      );
      idx += 1;
    }

    if (description !== undefined) {
      fields.push(`description = $${idx}`);
      values.push(description);
      idx += 1;
    }

    if (icon !== undefined) {
      fields.push(`icon = $${idx}`);
      values.push(icon);
      idx += 1;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    values.push(courseId);

    const result = await pool.query(
      `UPDATE courses
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, slug, description, icon, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Invalidate course-related caches
    await cacheDeletePattern('courses:*');
    await cacheDeletePattern('course:*');

    res.json({
      message: 'Course updated successfully',
      course: result.rows[0],
    });
  } catch (error) {
    console.error('Update course error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Course with this name or slug already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a course (and its lessons via cascade)
router.delete('/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;

    const courseResult = await pool.query('SELECT slug FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const { slug } = courseResult.rows[0];

    await pool.query('DELETE FROM courses WHERE id = $1', [courseId]);

    // Invalidate course-related caches
    await cacheDeletePattern('courses:*');
    await cacheDeletePattern('course:*');
    await cacheDeletePattern(`course:${slug}`);

    res.json({ message: 'Course and its lessons deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new lesson (module) within a course
router.post('/courses/:courseId/lessons', async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, content, difficulty, estimated_time, code_example, code_language, order_index } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Lesson title is required' });
    }

    // Ensure course exists
    const courseResult = await pool.query('SELECT id, slug FROM courses WHERE id = $1', [courseId]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const course = courseResult.rows[0];

    // Determine next order index if not provided
    let nextOrder = order_index;
    if (nextOrder === undefined || nextOrder === null) {
    const orderResult = await pool.query(
      'SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order FROM lessons WHERE course_id = $1',
      [courseId]
    );
      nextOrder = parseInt(orderResult.rows[0].next_order, 10) || 1;
    }

    const slug = title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const result = await pool.query(
      `INSERT INTO lessons (course_id, title, slug, content, order_index, difficulty, estimated_time, code_example, code_language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, slug, content, order_index, difficulty, estimated_time, code_example, code_language`,
      [
        courseId,
        title,
        slug,
        content || '',
        nextOrder,
        difficulty || 'beginner',
        estimated_time || 0,
        code_example || '',
        code_language || 'java',
      ]
    );

    // Invalidate caches for this course and global course list
    await cacheDeletePattern('courses:*');
    await cacheDeletePattern(`course:${course.slug}`);

    res.status(201).json({
      message: 'Lesson created successfully',
      lesson: result.rows[0],
    });
  } catch (error) {
    console.error('Create lesson error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Lesson with this slug already exists in this course' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a lesson (module)
router.delete('/lessons/:lessonId', async (req, res) => {
  try {
    const { lessonId } = req.params;

    // Find course slug for cache invalidation
    const infoResult = await pool.query(
      `SELECT c.slug AS course_slug
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = $1`,
      [lessonId]
    );

    if (infoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const { course_slug } = infoResult.rows[0];

    await pool.query('DELETE FROM lessons WHERE id = $1', [lessonId]);

    // Invalidate caches for this course and global course list
    await cacheDeletePattern('courses:*');
    await cacheDeletePattern(`course:${course_slug}`);

    res.json({ message: 'Lesson deleted successfully' });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate lesson content using AI (TinyLlama)
router.post('/lessons/:lessonId/generate-content', async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { topics, difficulty } = req.body;

    // Get lesson details
    const lessonResult = await pool.query(
      `SELECT l.id, l.title, l.difficulty, c.name as course_name
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = $1`,
      [lessonId]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const lesson = lessonResult.rows[0];
    const courseName = lesson.course_name;
    const lessonTitle = lesson.title;
    const lessonDifficulty = difficulty || lesson.difficulty || 'beginner';
    
    // Prepare topics array
    let topicsArray = [];
    if (topics && Array.isArray(topics)) {
      topicsArray = topics.filter(t => t && t.trim());
    } else if (topics && typeof topics === 'string') {
      topicsArray = [topics];
    } else {
      // Default to lesson title if no topics provided
      topicsArray = [lessonTitle];
    }

    console.log(`Generating content for lesson: ${lessonTitle} (${courseName})`);

    // Generate content using the instructional design prompt
    const generatedContent = await generateLessonContent(
      courseName,
      lessonTitle,
      topicsArray,
      lessonDifficulty
    );

    // Update lesson in database
    const updateFields = ['content = $1'];
    const values = [generatedContent];
    let paramIndex = 2;

    // Update difficulty if provided
    if (difficulty) {
      updateFields.push(`difficulty = $${paramIndex}`);
      values.push(difficulty);
      paramIndex++;
    }

    values.push(lessonId);

    const updateResult = await pool.query(
      `UPDATE lessons 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, title, slug, content, difficulty`,
      values
    );

    if (updateResult.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to update lesson' });
    }

    // Invalidate caches
    await cacheDeletePattern('courses:*');
    await cacheDeletePattern('course:*');
    await cacheDeletePattern('admin:*');

    res.json({
      message: 'Content generated and saved successfully',
      lesson: updateResult.rows[0],
      contentLength: generatedContent.length
    });
  } catch (error) {
    console.error('Generate content error:', error);
    res.status(500).json({ 
      error: 'Failed to generate content',
      details: error.message 
    });
  }
});

module.exports = router;

