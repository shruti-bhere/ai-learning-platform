const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { cacheGet, cacheSet } = require('../config/redis');

const router = express.Router();

// Get all courses
router.get('/', async (req, res) => {
  try {
    const cacheKey = 'courses:all';
    const cached = await cacheGet(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    // Get basic course info
    const result = await pool.query(
      `SELECT c.*, 
       COUNT(DISTINCT l.id) as total_lessons
       FROM courses c
       LEFT JOIN lessons l ON c.id = l.course_id
       GROUP BY c.id
       ORDER BY c.name`
    );

    // Get completed lessons count for authenticated users
    let userId = null;
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
      }
    } catch (e) {
      // Not authenticated or invalid token
    }

    const courses = await Promise.all(result.rows.map(async (course) => {
      let completed_lessons = 0;
      if (userId) {
        const completedResult = await pool.query(
          `SELECT COUNT(*) as count FROM lesson_progress lp
           JOIN lessons l ON lp.lesson_id = l.id
           WHERE l.course_id = $1 AND lp.user_id = $2 AND lp.completed = true`,
          [course.id, userId]
        );
        completed_lessons = parseInt(completedResult.rows[0].count);
      }
      return {
        ...course,
        total_lessons: parseInt(course.total_lessons),
        completed_lessons
      };
    }));

    await cacheSet(cacheKey, courses, 300);
    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get course by slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cacheKey = `course:${slug}`;
    const cached = await cacheGet(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const courseResult = await pool.query(
      'SELECT * FROM courses WHERE slug = $1',
      [slug]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];

    // Get user ID from token if available (optional auth)
    let userId = null;
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.userId;
      }
    } catch (e) {
      // Token invalid or missing, continue without user
    }

    // Get lessons for this course
    const lessonsResult = await pool.query(
      `SELECT l.*, 
       COALESCE(lp.completed, false) as completed,
       COALESCE(lp.progress_percentage, 0) as progress_percentage
       FROM lessons l
       LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = $1
       WHERE l.course_id = $2
       ORDER BY l.order_index`,
      [userId, course.id]
    );

    course.lessons = lessonsResult.rows;

    await cacheSet(cacheKey, course, 300);
    res.json(course);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lesson by course and lesson slug
router.get('/:courseSlug/lessons/:lessonSlug', authenticate, async (req, res) => {
  try {
    const { courseSlug, lessonSlug } = req.params;

    const courseResult = await pool.query(
      'SELECT id FROM courses WHERE slug = $1',
      [courseSlug]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const lessonResult = await pool.query(
      `SELECT l.*, 
       COALESCE(lp.completed, false) as completed,
       COALESCE(lp.progress_percentage, 0) as progress_percentage,
       COALESCE(lp.points_earned, 0) as points_earned
       FROM lessons l
       LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = $1
       WHERE l.course_id = $2 AND l.slug = $3`,
      [req.user.id, courseResult.rows[0].id, lessonSlug]
    );

    if (lessonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Get previous and next lessons
    const allLessonsResult = await pool.query(
      'SELECT id, slug, title FROM lessons WHERE course_id = $1 ORDER BY order_index',
      [courseResult.rows[0].id]
    );

    const currentIndex = allLessonsResult.rows.findIndex(l => l.slug === lessonSlug);
    const lesson = lessonResult.rows[0];
    lesson.previous_lesson = currentIndex > 0 ? allLessonsResult.rows[currentIndex - 1] : null;
    lesson.next_lesson = currentIndex < allLessonsResult.rows.length - 1 ? allLessonsResult.rows[currentIndex + 1] : null;

    res.json(lesson);
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

