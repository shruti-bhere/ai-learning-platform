const express = require('express');
const { authenticate } = require('../middleware/auth');
const { analyzeCodeWithOllama } = require('../services/codeAnalysis');

const router = express.Router();

/**
 * POST /api/analyze/code
 * Analyze code for quality, improvements, mistakes, and suggestions
 */
router.post('/code', authenticate, async (req, res) => {
  try {
    const { code, language, lessonTitle, lessonTopic } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    const analysis = await analyzeCodeWithOllama(code, language, lessonTitle, lessonTopic);
    res.json(analysis);
  } catch (error) {
    console.error('Code analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze code', 
      message: error.message 
    });
  }
});

module.exports = router;
