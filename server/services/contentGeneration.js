/**
 * Content Generation Service
 * Generates comprehensive lesson content using TinyLlama via Ollama
 */

// Node.js 18+ has fetch built-in, no need to require node-fetch
// If you're using Node.js < 18, you'll need to install node-fetch

const OLLAMA_URL = process.env.OLLAMA_URL || (process.env.DB_HOST === 'postgres' ? 'http://ollama:11434' : 'http://localhost:11434');
const MODEL_NAME = process.env.OLLAMA_MODEL || 'tinyllama';

/**
 * Create the comprehensive instructional design prompt
 */
function createInstructionalDesignPrompt(courseName, lessonTitle, topics, difficulty) {
  const topicsList = Array.isArray(topics) ? topics.join(', ') : topics || '';
  
  return `Act as an expert Instructional Designer and Subject Matter Expert. Your task is to create comprehensive, detailed lesson content for the course titled: ${courseName}.

Topic: ${lessonTitle}
Difficulty Level: ${difficulty}
Topics to Cover: ${topicsList}

For this topic, please follow this strict structure:

## Learning Objectives
What will the student learn? Provide 3-5 clear, measurable learning objectives.

## Concept Explanation
A deep-dive explanation of the topic in simple, professional language. Make it comprehensive enough for a beginner to understand complex ideas.

## Real-World Examples
Provide at least two practical examples to illustrate the concept. Each example should be concrete and relatable.

## Step-by-Step Breakdown
If the topic involves a process, explain it stage by stage. Break down complex concepts into manageable steps.

## Key Takeaways
A summary of the most important points from the lesson.

Formatting Instructions:
- Use markdown formatting with ## for main headings and ### for subheadings
- Use **bold** for emphasis on important terms
- Use bullet points (-) for lists
- Only use code blocks (\`\`\`) for actual programming code or technical syntax
- Do NOT wrap plain text explanations in code blocks
- Keep the tone educational, encouraging, and clear
- Provide enough depth so that a beginner can understand complex ideas
- Avoid surface-level summaries

Generate the content now:`;
}

/**
 * Call Ollama API to generate content
 */
async function callOllamaAPI(prompt, timeoutMs = 180000) { // 3 minutes timeout for comprehensive content
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 2500, // Increased for comprehensive content
        }
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    console.error('Error calling Ollama API:', error.message);
    throw error;
  }
}

/**
 * Generate comprehensive lesson content
 */
async function generateLessonContent(courseName, lessonTitle, topics, difficulty = 'beginner') {
  try {
    const prompt = createInstructionalDesignPrompt(courseName, lessonTitle, topics, difficulty);
    const response = await callOllamaAPI(prompt);
    
    // Clean up the response - remove any extra formatting or artifacts
    let content = response.trim();
    
    // Ensure the content starts with proper markdown structure
    if (!content.startsWith('#')) {
      // If it doesn't start with a heading, try to find the first heading
      const firstHeadingIndex = content.search(/^#+\s/);
      if (firstHeadingIndex !== -1) {
        content = content.substring(firstHeadingIndex);
      }
    }
    
    return content;
  } catch (error) {
    console.error(`Error generating lesson content:`, error.message);
    throw error;
  }
}

module.exports = {
  generateLessonContent,
  createInstructionalDesignPrompt
};

