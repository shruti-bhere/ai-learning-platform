/**
 * Content Generation Service
 * Generates comprehensive lesson content using TinyLlama via Ollama
 */

// Node.js 18+ has fetch built-in, no need to require node-fetch
// If you're using Node.js < 18, you'll need to install node-fetch

const OLLAMA_URL = process.env.OLLAMA_URL || (process.env.DB_HOST === 'postgres' ? 'http://ollama:11434' : 'http://localhost:11434');
const MODEL_NAME = process.env.OLLAMA_MODEL || 'tinyllama';

/**
 * Create the educational content generation prompt
 * Focuses on clear, step-by-step, well-structured, beginner-friendly content
 */
function createInstructionalDesignPrompt(courseName, lessonTitle, topics, difficulty) {
  const topicsList = Array.isArray(topics) ? topics.join(', ') : topics || '';
  
  return `You are an educational content generator.

Your task is to create clear, step-by-step, and well-structured educational content about the following topic(s): ${topicsList}

Difficulty Level: ${difficulty}

IMPORTANT: Write content directly about the topic(s). Do NOT mention course names, lesson names, or meta-information about the course structure. Focus purely on explaining the topic itself.

Requirements:

For the topic(s), include:
- A simple and easy-to-understand explanation
- At least 2 practical examples

If the topic involves programming:
- Display example code inside a proper code editor-style block
- Ensure the code is error-free and runnable
- Use correct formatting and syntax highlighting

The content must be:
- Clean
- Well-structured
- Beginner-friendly
- Easy to read and understand
- Focused on the topic itself, not on course/lesson structure

Avoid unnecessary repetition and keep everything logically organized in one structured flow.

The final output should feel like a professional online learning platform, where users can easily read, understand, and learn from the content.

Formatting Instructions:
- Use markdown formatting with ## for main headings and ### for subsections
- Use **bold** for emphasis on important terms
- Use bullet points (-) for lists
- Use numbered lists (1., 2., 3.) for step-by-step instructions
- ONLY use code blocks (\`\`\`) for actual programming code - NEVER wrap plain text explanations in code blocks
- Keep paragraphs short (3-4 sentences) for easy reading
- Use blank lines between sections for visual clarity

Writing Style:
- Write in a clear, conversational tone
- Use simple language that beginners can understand
- Explain technical terms when first introduced
- Break down complex concepts into simple steps
- Use real-world analogies to make concepts relatable
- Be encouraging and supportive
- Focus on the topic content itself - do not reference course names, lesson titles, or learning objectives

Generate the content now. Write directly about ${topicsList} without mentioning course or lesson names:`;
}

/**
 * Call Ollama API to generate content
 */
async function callOllamaAPI(prompt, timeoutMs = 300000) { // 5 minutes timeout for very detailed content
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
          num_predict: 5000, // Increased for extremely detailed, well-structured content
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
 * Remove code blocks that contain plain text (not actual code)
 * This fixes the common error of wrapping explanations in code blocks
 */
function removePlainTextCodeBlocks(content) {
  // Match code blocks with optional language identifier
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
  
  return content.replace(codeBlockRegex, (match, codeContent) => {
    const trimmed = codeContent.trim();
    
    // Check if it's actual code (contains programming syntax indicators)
    const codeIndicators = [
      /^(public|private|protected|class|interface|enum|import|package)\s/, // Java keywords
      /^(def|class|import|from|if|for|while|def)\s/, // Python keywords
      /^(function|const|let|var|class|import|export)\s/, // JavaScript keywords
      /^(func|package|import|var|const|type)\s/, // Go keywords
      /[{}();=<>\[\]]/, // Code punctuation
      /^\s*(int|String|double|float|boolean|void|return)\s/, // Type declarations
      /\/\/|\/\*|\*\/|#\s/, // Comments
    ];
    
    // Check if it looks like actual code
    const looksLikeCode = codeIndicators.some(pattern => pattern.test(trimmed));
    
    // Also check if it's mostly code-like (has code structure)
    const hasCodeStructure = trimmed.includes('{') || trimmed.includes('(') || 
                            trimmed.includes(';') || trimmed.includes('=') ||
                            trimmed.match(/^\s*\w+\s*\(/); // Function calls
    
    // If it doesn't look like code, remove the code block and return as plain text
    if (!looksLikeCode && !hasCodeStructure && trimmed.length > 50) {
      // It's likely plain text wrapped in code block - remove the block markers
      return trimmed;
    }
    
    // It's actual code, keep the code block
    return match;
  });
}

/**
 * Clean and format the generated content
 */
function cleanGeneratedContent(content) {
  // Remove code blocks containing plain text
  content = removePlainTextCodeBlocks(content);
  
  // Remove any triple backticks that might be left without proper code
  // This handles cases where AI wraps explanations in empty or malformed code blocks
  content = content.replace(/```\s*\n\s*```/g, ''); // Empty code blocks
  content = content.replace(/```\s*\n([^`\n]+)\n\s*```/g, (match, text) => {
    // If the content doesn't look like code, remove code block markers
    if (!text.match(/[{}();=<>\[\]]/) && !text.match(/^\s*(public|private|class|def|function|const|let|var)\s/)) {
      return text.trim();
    }
    return match;
  });
  
  // Clean up extra whitespace
  content = content.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  
  return content;
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
    
    // Remove code block errors (plain text wrapped in code blocks)
    content = cleanGeneratedContent(content);
    
    // Ensure the content starts with proper markdown structure
    if (!content.startsWith('#')) {
      // If it doesn't start with a heading, try to find the first heading
      const firstHeadingIndex = content.search(/^#+\s/m);
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

