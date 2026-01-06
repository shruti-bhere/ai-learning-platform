const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');
// fetch is built-in for Node.js 18+, no need to require it
const { generateLessonContent } = require('../services/contentGeneration');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'learning_platform',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Course-specific lesson outlines
const courseLessonOutlines = {
  java: [
    { title: 'Introduction to Java', topics: ['JDK vs JRE vs JVM', 'Setting up environment', 'Hello World program', 'Java syntax basics'] },
    { title: 'Java Syntax and Variables', topics: ['Primitive types', 'Reference types', 'Type casting', 'Variables and constants'] },
    { title: 'Control Flow and Loops', topics: ['Arithmetic operators', 'Logical operators', 'if-else statements', 'switch-case', 'Loops'] },
    { title: 'Arrays and Strings', topics: ['Single and multi-dimensional arrays', 'String class', 'StringBuilder and StringBuffer'] },
    { title: 'Object-Oriented Programming', topics: ['Classes and objects', 'Constructors', 'Access modifiers', 'Static vs instance'] },
    { title: 'Inheritance and Polymorphism', topics: ['Inheritance with extends', 'Method overriding', 'Method overloading', 'Super keyword'] },
    { title: 'Exception Handling', topics: ['Try-catch-finally', 'Checked vs unchecked exceptions', 'Custom exceptions'] },
    { title: 'Collections Framework', topics: ['ArrayList', 'LinkedList', 'HashMap', 'TreeSet', 'Generics'] }
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

// Note: generateLessonContent is now imported from the service
// This function is kept for backward compatibility but now uses the service
async function generateLessonContentWrapper(courseName, lessonTitle, topics, difficulty) {
  console.log(`  Generating lesson content for: ${lessonTitle}...`);
  try {
    return await generateLessonContent(courseName, lessonTitle, topics, difficulty);
  } catch (error) {
    console.error(`  Error generating lesson content:`, error.message);
    throw error;
  }
}

async function generateCodeExample(courseName, lessonTitle, topics) {
  console.log(`  Generating code example for: ${lessonTitle}...`);
  
  try {
    const lang = courseName === 'Java' ? 'java' : 
                 courseName === 'Python' ? 'python' : 
                 courseName === 'Node.js' ? 'javascript' : 'go';

    const prompt = `Write a simple ${lang} code example for "${lessonTitle}" covering: ${topics.join(', ')}.

Requirements:
- Complete, runnable code
- Include comments explaining key parts
- Demonstrate the main concepts from the lesson
- Make it beginner-friendly

Return only the code, no explanations.`;

    const response = await callOllamaAPI(prompt);
    return response.trim();
  } catch (error) {
    console.error(`  Error generating code example:`, error.message);
    return `// Code example for ${lessonTitle}\n// Add your code here`;
  }
}

async function generateQAndA(courseName, lessonTitle, topics, difficulty) {
  console.log(`  Generating Q&A for: ${lessonTitle}...`);
  
  try {
    const prompt = `Create 5 basic Q&A pairs for a ${difficulty} level lesson on "${lessonTitle}" for ${courseName}.

Topics covered: ${topics.join(', ')}

Format each Q&A as:
Q: [Question]
A: [Answer]

Questions should be simple and help students understand the key concepts.
Answers should be clear and concise (2-3 sentences).

Return only the Q&A pairs, one per line.`;

    const response = await callOllamaAPI(prompt);
    
    // Format Q&A section for markdown
    const qaFormatted = `\n\n## Questions and Answers\n\n${response.trim()}\n`;
    return qaFormatted;
  } catch (error) {
    console.error(`  Error generating Q&A:`, error.message);
    return `\n\n## Questions and Answers\n\nQ: What is ${lessonTitle}?\nA: ${lessonTitle} is a fundamental concept in ${courseName} that covers ${topics[0] || 'key programming concepts'}.\n\n`;
  }
}

async function generateAllContent() {
  try {
    console.log('🚀 Starting content generation with TinyLlama...\n');
    console.log(`Using model: ${MODEL_NAME}`);
    console.log(`Ollama URL: ${OLLAMA_URL}\n`);

    // Get all courses
    const coursesResult = await pool.query('SELECT id, name, slug FROM courses ORDER BY id');
    const courses = coursesResult.rows;

    if (courses.length === 0) {
      console.log('No courses found in database.');
      return;
    }

    for (const course of courses) {
      console.log(`\n📚 Processing course: ${course.name} (${course.slug})`);
      
      // Get lesson outline for this course
      const lessonOutlines = courseLessonOutlines[course.slug] || [];
      
      if (lessonOutlines.length === 0) {
        console.log(`  ⚠️  No lesson outlines defined for ${course.slug}`);
        continue;
      }

      // Get existing lessons for this course
      const lessonsResult = await pool.query(
        'SELECT id, title, slug, difficulty FROM lessons WHERE course_id = $1 ORDER BY order_index',
        [course.id]
      );
      const existingLessons = lessonsResult.rows;

      if (existingLessons.length === 0) {
        console.log(`  ⚠️  No existing lessons found for ${course.name}`);
        continue;
      }

      // Match existing lessons with outlines
      for (let i = 0; i < existingLessons.length && i < lessonOutlines.length; i++) {
        const lesson = existingLessons[i];
        const outline = lessonOutlines[i];
        const difficulty = lesson.difficulty || 'beginner';

        console.log(`\n  📝 Lesson ${i + 1}/${existingLessons.length}: ${lesson.title}`);

        let retries = 2;
        let success = false;
        
        while (retries > 0 && !success) {
          try {
            // Generate lesson content using the new instructional design prompt
            const lessonContent = await generateLessonContentWrapper(
              course.name,
              lesson.title,
              outline.topics,
              difficulty
            );

            // Generate code example
            const codeExample = await generateCodeExample(
              course.name,
              lesson.title,
              outline.topics
            );

            // Generate Q&A section
            const qaSection = await generateQAndA(
              course.name,
              lesson.title,
              outline.topics,
              difficulty
            );

            // Combine all content
            const fullContent = `${lessonContent}\n\n## Code Example\n\n\`\`\`${course.name === 'Java' ? 'java' : course.name === 'Python' ? 'python' : course.name === 'Node.js' ? 'javascript' : 'go'}\n${codeExample}\n\`\`\`${qaSection}`;

            // Update lesson in database
            await pool.query(
              `UPDATE lessons 
               SET content = $1, code_example = $2, code_language = $3 
               WHERE id = $4`,
              [
                fullContent,
                codeExample,
                course.name === 'Java' ? 'java' : 
                course.name === 'Python' ? 'python' : 
                course.name === 'Node.js' ? 'javascript' : 'go',
                lesson.id
              ]
            );

            console.log(`  ✅ Updated lesson: ${lesson.title}`);
            success = true;

            // Delay to avoid overwhelming Ollama
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            retries--;
            if (retries > 0) {
              console.log(`  ⚠️  Retrying... (${retries} attempts left)`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              console.error(`  ❌ Failed to update ${lesson.title}:`, error.message);
              // Continue with next lesson
            }
          }
        }
      }
    }

    console.log('\n✅ Content generation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error generating content:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
generateAllContent();

