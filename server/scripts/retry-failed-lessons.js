const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'learning_platform',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Use 'ollama' service name when running in Docker, 'localhost' when running from host
const OLLAMA_URL = process.env.OLLAMA_URL || (process.env.DB_HOST === 'postgres' ? 'http://ollama:11434' : 'http://localhost:11434');
const MODEL_NAME = 'qwen2.5-coder:1.5b';

// Import the functions from the main script
const courseLessonOutlines = {
  java: [
    { title: 'Introduction to Java', topics: ['JDK vs JRE vs JVM', 'Setting up environment', 'Hello World program', 'Java syntax basics'] },
    { title: 'Java Syntax and Variables', topics: ['Primitive types', 'Reference types', 'Type casting', 'Variables and constants'] },
    { title: 'Control Flow and Loops', topics: ['Arithmetic operators', 'Logical operators', 'if-else statements', 'switch-case', 'Loops'] },
    { title: 'Object-Oriented Programming', topics: ['Classes and objects', 'Constructors', 'Access modifiers', 'Static vs instance'] },
    { title: 'Collections and Generics', topics: ['ArrayList', 'LinkedList', 'HashMap', 'TreeSet', 'Generics'] },
    { title: 'Exception Handling', topics: ['Try-catch-finally', 'Checked vs unchecked exceptions', 'Custom exceptions'] },
    { title: 'Multithreading', topics: ['Threads', 'Synchronization', 'Concurrency', 'Thread pools'] },
    { title: 'Java Streams and Lambda', topics: ['Lambda expressions', 'Stream API', 'Functional programming', 'Method references'] }
  ],
  python: [
    { title: 'Python Basics', topics: ['Introduction to Python', 'Installation', 'First program', 'Python syntax'] },
    { title: 'Variables and Data Types', topics: ['Numbers', 'Strings', 'Lists', 'Dictionaries', 'Type conversion'] },
    { title: 'Control Flow', topics: ['If-else statements', 'Loops (for, while)', 'Break and continue', 'List comprehensions'] },
    { title: 'Functions and Modules', topics: ['Defining functions', 'Parameters and arguments', 'Return values', 'Modules and imports'] },
    { title: 'Object-Oriented Programming', topics: ['Classes and objects', 'Inheritance', 'Encapsulation', 'Polymorphism'] },
    { title: 'File Handling', topics: ['Reading files', 'Writing files', 'Exception handling', 'Working with CSV and JSON'] },
    { title: 'Decorators and Generators', topics: ['Function decorators', 'Generator functions', 'Iterators', 'Context managers'] },
    { title: 'Advanced Topics', topics: ['Regular expressions', 'Working with dates', 'Lambda functions', 'Map, filter, reduce'] }
  ],
  nodejs: [
    { title: 'Introduction to Node.js', topics: ['What is Node.js', 'Event-driven architecture', 'NPM basics', 'First Node.js application'] },
    { title: 'Node.js Modules and NPM', topics: ['CommonJS modules', 'require and exports', 'Built-in modules', 'Creating custom modules'] },
    { title: 'File System Operations', topics: ['Reading files', 'Writing files', 'Directories', 'File streams'] },
    { title: 'HTTP Server and Express', topics: ['Creating HTTP server', 'Express.js basics', 'Routing', 'Middleware'] },
    { title: 'Database Integration', topics: ['Connecting to databases', 'MongoDB with Mongoose', 'PostgreSQL', 'Query operations'] },
    { title: 'Authentication and Security', topics: ['JWT authentication', 'Password hashing', 'Middleware for auth', 'Security best practices'] },
    { title: 'Real-time with Socket.io', topics: ['WebSockets', 'Socket.io basics', 'Real-time communication', 'Rooms and namespaces'] },
    { title: 'Performance and Optimization', topics: ['Caching strategies', 'Async operations', 'Error handling', 'Production deployment'] }
  ],
  golang: [
    { title: 'Go Basics', topics: ['Introduction to Go', 'Installation', 'Go workspace', 'First program'] },
    { title: 'Variables and Types', topics: ['Data types', 'Variables and constants', 'Type system', 'Type conversion'] },
    { title: 'Functions and Methods', topics: ['Function syntax', 'Multiple return values', 'Methods', 'Function types'] },
    { title: 'Control Flow', topics: ['If-else', 'Switch statements', 'For loops', 'Range'] },
    { title: 'Structs and Interfaces', topics: ['Structs', 'Methods on structs', 'Interfaces', 'Interface implementation'] },
    { title: 'Concurrency with Goroutines', topics: ['Goroutines', 'Channels', 'Select statement', 'Sync package'] },
    { title: 'Error Handling', topics: ['Error interface', 'Error handling patterns', 'Panic and recover', 'Best practices'] },
    { title: 'Packages and Modules', topics: ['Package organization', 'Go modules', 'Importing packages', 'Building applications'] }
  ]
};

async function callOllamaAPI(prompt, timeoutMs = 120000) {
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
          num_predict: 2000,
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

function createLessonPrompt(courseName, lessonTitle, topics, difficulty) {
  return `Create a ${difficulty} level lesson on "${lessonTitle}" for ${courseName}.

Topics: ${topics.join(', ')}

Include:
- Introduction
- Explanations with examples
- Markdown formatting with headings (##, ###)
- Code blocks with syntax highlighting
- Summary

Keep it clear and student-friendly.`;
}

function createCodeExamplePrompt(courseName, lessonTitle, topics) {
  return `Write a ${courseName} code example for "${lessonTitle}" covering: ${topics.join(', ')}.

Include comments. Make it runnable and practical.`;
}

async function generateLessonContent(courseName, lessonTitle, topics, difficulty) {
  console.log(`  Generating content for: ${lessonTitle}...`);
  
  try {
    // Generate main content
    const contentPrompt = createLessonPrompt(courseName, lessonTitle, topics, difficulty);
    const content = await callOllamaAPI(contentPrompt);
    
    // Generate code example
    const codePrompt = createCodeExamplePrompt(courseName, lessonTitle, topics);
    const codeExample = await callOllamaAPI(codePrompt);
    
    return {
      content: content.trim(),
      codeExample: codeExample.trim(),
      codeLanguage: courseName === 'Java' ? 'java' : 
                    courseName === 'Python' ? 'python' : 
                    courseName === 'Node.js' ? 'javascript' : 'go'
    };
  } catch (error) {
    console.error(`  Error generating content for ${lessonTitle}:`, error.message);
    throw error;
  }
}

async function retryFailedLessons() {
  try {
    console.log('🔄 Retrying failed lessons (placeholders only)...\n');

    // Find lessons with placeholder content (short content)
    const placeholderLessons = await pool.query(`
      SELECT l.id, l.title, l.slug, c.name as course_name, c.slug as course_slug
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE LENGTH(l.content) < 500
      ORDER BY c.name, l.order_index
    `);

    if (placeholderLessons.rows.length === 0) {
      console.log('✅ No placeholder lessons found. All lessons have content!');
      return;
    }

    console.log(`Found ${placeholderLessons.rows.length} lessons with placeholder content:\n`);

    for (const lesson of placeholderLessons.rows) {
      const courseSlug = lesson.course_slug;
      const outline = courseLessonOutlines[courseSlug];
      
      if (!outline) {
        console.log(`⚠️  No outline found for course: ${courseSlug}, skipping ${lesson.title}`);
        continue;
      }

      // Find the lesson outline
      const lessonOutline = outline.find(l => l.title === lesson.title);
      
      if (!lessonOutline) {
        console.log(`⚠️  No outline found for lesson: ${lesson.title}, skipping`);
        continue;
      }

      // Determine difficulty (you can adjust this logic)
      const difficulty = lesson.order_index <= 2 ? 'beginner' : 
                        lesson.order_index <= 5 ? 'intermediate' : 'advanced';

      console.log(`\n📝 Retrying: ${lesson.course_name} - ${lesson.title}`);
      
      try {
        const { content, codeExample, codeLanguage } = await generateLessonContent(
          lesson.course_name,
          lesson.title,
          lessonOutline.topics,
          difficulty
        );

        // Update the lesson
        await pool.query(`
          UPDATE lessons
          SET content = $1, code_example = $2, code_language = $3
          WHERE id = $4
        `, [content, codeExample, codeLanguage, lesson.id]);

        console.log(`  ✅ Updated: ${lesson.title}`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`  ❌ Failed to update ${lesson.title}:`, error.message);
        // Continue with next lesson
      }
    }

    console.log('\n✅ Retry completed!');
  } catch (error) {
    console.error('❌ Error retrying failed lessons:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

retryFailedLessons();

