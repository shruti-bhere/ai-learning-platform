/**
 * Script to restructure all lessons across all courses (Java, Python, Go, Node.js)
 * to follow the beginner-to-advanced format with:
 * - Theory Section with Key Concepts
 * - Interactive Examples with numbered walkthroughs
 * - Deep Dive sections
 * - Knowledge Check challenges
 * 
 * Usage: node server/scripts/restructure-all-lessons.js
 */

const { Pool } = require('pg');
const { generateWalkthrough } = require('../utils/codeWalkthroughGenerator');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'learning_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Extracts key concepts from lesson content
 */
function extractKeyConcepts(content) {
  const concepts = [];
  
  // Look for common patterns that indicate concepts
  const conceptPatterns = [
    /(?:key|important|concept|note|remember)[\s:]+([^\.\n]+)/gi,
    /(?:uses?|allows?|enables?|provides?)\s+([^\.\n]+)/gi,
  ];
  
  // Extract from bullet points
  const bulletMatch = content.match(/[-*]\s+([^\n]+)/g);
  if (bulletMatch) {
    bulletMatch.slice(0, 5).forEach(bullet => {
      const concept = bullet.replace(/[-*]\s+/, '').trim();
      if (concept.length > 10 && concept.length < 150) {
        concepts.push(concept);
      }
    });
  }
  
  return concepts.slice(0, 5); // Max 5 key concepts
}

/**
 * Restructures a lesson's content to the new format
 */
function restructureLessonContent(lesson) {
  if (!lesson.content) return lesson.content;
  
  let content = lesson.content;
  const title = lesson.title;
  
  // Extract existing sections
  const codeBlocks = [];
  const codeBlockRegex = /```(?:java|python|javascript|go)?\n([\s\S]*?)```/g;
  let codeMatch;
  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push(codeMatch[1]);
  }
  
  // Extract key concepts
  const keyConcepts = extractKeyConcepts(content);
  
  // Check if already restructured
  if (content.includes('## Theory Section') && content.includes('### Key Concepts')) {
    console.log(`  - Already restructured, skipping...`);
    return null; // Already done
  }
  
  // Build new structure
  let newContent = `# ${title}\n\n`;
  
  // Theory Section
  newContent += `## Theory Section\n\n`;
  
  // Extract intro/explanation (first paragraph or two)
  const introMatch = content.match(/^#\s+[^\n]+\n\n([^\n#]+(?:\n[^\n#]+)*)/);
  if (introMatch) {
    newContent += introMatch[1].trim() + '\n\n';
  } else {
    // Try to get first meaningful paragraph
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
    if (paragraphs.length > 0) {
      newContent += paragraphs[0].trim() + '\n\n';
    }
  }
  
  // Key Concepts
  if (keyConcepts.length > 0) {
    newContent += `### Key Concepts\n`;
    keyConcepts.forEach(concept => {
      newContent += `- ${concept}\n`;
    });
    newContent += '\n';
  } else {
    // Generate default key concepts based on title
    const defaultConcepts = generateDefaultConcepts(title, content);
    newContent += `### Key Concepts\n`;
    defaultConcepts.forEach(concept => {
      newContent += `- ${concept}\n`;
    });
    newContent += '\n';
  }
  
  // Interactive Examples
  if (codeBlocks.length > 0) {
    newContent += `## Interactive Example\n\n`;
    
    codeBlocks.forEach((code, index) => {
      const level = codeBlocks.length > 1 ? 
        (index === 0 ? 'Beginner' : index === codeBlocks.length - 1 ? 'Advanced' : 'Intermediate') : 
        '';
      
      if (level) {
        newContent += `### ${level}: ${getExampleTitle(code, title)}\n\n`;
      }
      
      // Detect language
      const language = detectLanguage(code);
      newContent += `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
      
      // Generate walkthrough
      const walkthrough = generateWalkthrough(code);
      if (walkthrough && !walkthrough.includes('Unable to generate')) {
        newContent += walkthrough + '\n\n';
      }
    });
  }
  
  // Deep Dive Section
  const deepDiveContent = extractDeepDive(content);
  if (deepDiveContent) {
    newContent += `## Deep Dive: Under the Hood\n\n${deepDiveContent}\n\n`;
  } else {
    // Generate default deep dive
    newContent += generateDefaultDeepDive(title, content) + '\n\n';
  }
  
  // Knowledge Check
  const knowledgeCheck = extractKnowledgeCheck(content);
  if (knowledgeCheck) {
    newContent += `## Knowledge Check\n\n${knowledgeCheck}\n\n`;
  } else {
    newContent += generateDefaultKnowledgeCheck(title) + '\n\n';
  }
  
  // Preserve any remaining important sections
  const remainingSections = extractRemainingSections(content);
  if (remainingSections) {
    newContent += remainingSections;
  }
  
  return newContent;
}

/**
 * Generate default key concepts based on title
 */
function generateDefaultConcepts(title, content) {
  const titleLower = title.toLowerCase();
  const concepts = [];
  
  if (titleLower.includes('variable') || titleLower.includes('data type')) {
    concepts.push('Variables store data values that can change during program execution');
    concepts.push('Each variable has a specific data type (int, String, boolean, etc.)');
    concepts.push('Variables must be declared before use');
  } else if (titleLower.includes('if') || titleLower.includes('condition')) {
    concepts.push('Conditions evaluate to true or false');
    concepts.push('If-else statements control program flow based on conditions');
    concepts.push('Comparison and logical operators create conditions');
  } else if (titleLower.includes('loop') || titleLower.includes('for') || titleLower.includes('while')) {
    concepts.push('Loops repeat code execution until a condition is met');
    concepts.push('Different loop types (for, while, do-while) suit different scenarios');
    concepts.push('Break and continue statements control loop execution');
  } else if (titleLower.includes('function') || titleLower.includes('method')) {
    concepts.push('Functions group code into reusable blocks');
    concepts.push('Functions can accept parameters and return values');
    concepts.push('Functions improve code organization and reusability');
  } else if (titleLower.includes('class') || titleLower.includes('object')) {
    concepts.push('Classes define blueprints for creating objects');
    concepts.push('Objects are instances of classes with their own state and behavior');
    concepts.push('Encapsulation bundles data and methods together');
  } else {
    concepts.push('Understanding core programming concepts');
    concepts.push('Practical application of programming principles');
    concepts.push('Best practices for writing clean code');
  }
  
  return concepts;
}

/**
 * Get example title from code
 */
function getExampleTitle(code, lessonTitle) {
  if (code.includes('switch')) return 'Switch Statement';
  if (code.includes('if') && code.includes('else')) return 'If-Else Statement';
  if (code.includes('for') || code.includes('while')) return 'Loop Example';
  if (code.includes('class')) return 'Class Definition';
  if (code.includes('function') || code.includes('def') || code.includes('func')) return 'Function Example';
  return 'Code Example';
}

/**
 * Detect programming language from code
 */
function detectLanguage(code) {
  if (code.includes('public class') || code.includes('System.out.println')) return 'java';
  if (code.includes('def ') || code.includes('print(') && !code.includes('console.')) return 'python';
  if (code.includes('func ') || code.includes('package ')) return 'go';
  if (code.includes('const ') || code.includes('let ') || code.includes('console.')) return 'javascript';
  return 'java'; // default
}

/**
 * Extract deep dive content from existing lesson
 */
function extractDeepDive(content) {
  // Look for sections like "Why This Works", "Advanced", "Under the Hood"
  const deepDivePatterns = [
    /(?:##\s+)?(?:Why This Works|Advanced|Under the Hood|How It Works|Deep Dive)[\s\S]*?(?=##|$)/i,
    /(?:###\s+)?(?:Why This Works|Advanced|Under the Hood)[\s\S]*?(?=###|##|$)/i,
  ];
  
  for (const pattern of deepDivePatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return null;
}

/**
 * Generate default deep dive content
 */
function generateDefaultDeepDive(title, content) {
  const titleLower = title.toLowerCase();
  let deepDive = `## Deep Dive: Under the Hood\n\n`;
  
  if (titleLower.includes('variable')) {
    deepDive += `### Why Variables Matter\n\n`;
    deepDive += `Variables are fundamental to programming because they allow you to store and manipulate data. Without variables, every value would need to be hardcoded, making programs inflexible and difficult to maintain.\n\n`;
    deepDive += `### Memory Management\n\n`;
    deepDive += `When you declare a variable, the program allocates memory space to store its value. The data type determines how much memory is allocated and how the value is interpreted.\n\n`;
  } else if (titleLower.includes('if') || titleLower.includes('condition')) {
    deepDive += `### Why If-Else is Essential\n\n`;
    deepDive += `Conditional statements are the foundation of decision-making in programming. They allow programs to respond differently based on different situations, making software dynamic and interactive.\n\n`;
    deepDive += `### Performance Considerations\n\n`;
    deepDive += `Modern compilers optimize if-else chains efficiently. For multiple conditions, consider using switch statements for better readability and potential performance improvements.\n\n`;
  } else if (titleLower.includes('loop')) {
    deepDive += `### Loop Efficiency\n\n`;
    deepDive += `Loops are powerful but can impact performance if not used carefully. Always ensure your loop condition will eventually become false to avoid infinite loops.\n\n`;
    deepDive += `### When to Use Each Loop Type\n\n`;
    deepDive += `- Use \`for\` loops when you know the iteration count\n`;
    deepDive += `- Use \`while\` loops for condition-based iteration\n`;
    deepDive += `- Use \`do-while\` when you need at least one execution\n\n`;
  } else {
    deepDive += `### Understanding the Concepts\n\n`;
    deepDive += `This topic is fundamental to programming. Understanding these concepts deeply will help you write more efficient and maintainable code.\n\n`;
    deepDive += `### Best Practices\n\n`;
    deepDive += `- Write clear, readable code\n`;
    deepDive += `- Follow language-specific conventions\n`;
    deepDive += `- Test your code thoroughly\n`;
    deepDive += `- Consider edge cases and error handling\n\n`;
  }
  
  return deepDive;
}

/**
 * Extract knowledge check from existing content
 */
function extractKnowledgeCheck(content) {
  const patterns = [
    /(?:##\s+)?(?:Knowledge Check|Challenge|Practice|Exercise|Quiz)[\s\S]*?(?=##|$)/i,
    /(?:###\s+)?(?:Challenge|Practice Exercise)[\s\S]*?(?=###|##|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return null;
}

/**
 * Generate default knowledge check
 */
function generateDefaultKnowledgeCheck(title) {
  const titleLower = title.toLowerCase();
  let challenge = `## Knowledge Check\n\n`;
  challenge += `**Challenge:** `;
  
  if (titleLower.includes('variable')) {
    challenge += `Create a program that declares at least three different types of variables (int, String, boolean) and prints their values. Try changing the values and observe the output.\n\n`;
  } else if (titleLower.includes('if') || titleLower.includes('condition')) {
    challenge += `Write a program that uses if-else statements to determine if a number is positive, negative, or zero. Test it with different values.\n\n`;
  } else if (titleLower.includes('loop')) {
    challenge += `Create a loop that prints numbers from 1 to 10. Then modify it to print only even numbers. Finally, make it print numbers in reverse order.\n\n`;
  } else if (titleLower.includes('function') || titleLower.includes('method')) {
    challenge += `Write a function that takes two parameters and returns their sum. Then create another function that uses the first function to calculate the average of three numbers.\n\n`;
  } else {
    challenge += `Apply what you've learned by creating a small program that demonstrates the key concepts from this lesson. Experiment with different values and see how the output changes.\n\n`;
  }
  
  challenge += `**Try It Yourself:** Modify the examples in this lesson with your own values. Experiment with edge cases and see what happens when you change different parts of the code!\n\n`;
  
  return challenge;
}

/**
 * Extract remaining important sections
 */
function extractRemainingSections(content) {
  const sections = [];
  
  // Look for Summary, Best Practices, Common Mistakes
  const importantSections = [
    /(?:##\s+)?Summary[\s\S]*?(?=##|$)/i,
    /(?:##\s+)?Best Practices[\s\S]*?(?=##|$)/i,
    /(?:##\s+)?Common Mistakes[\s\S]*?(?=##|$)/i,
  ];
  
  importantSections.forEach(pattern => {
    const match = content.match(pattern);
    if (match) {
      sections.push(match[0].trim());
    }
  });
  
  return sections.length > 0 ? sections.join('\n\n') + '\n\n' : '';
}

/**
 * Update a single lesson
 */
async function updateLesson(lesson) {
  try {
    const newContent = restructureLessonContent(lesson);
    
    if (!newContent) {
      return false; // Already restructured
    }
    
    await pool.query(
      'UPDATE lessons SET content = $1 WHERE id = $2',
      [newContent, lesson.id]
    );
    
    console.log(`  ✓ Lesson ${lesson.id}: Restructured successfully`);
    return true;
  } catch (error) {
    console.error(`  ✗ Lesson ${lesson.id}: Error - ${error.message}`);
    return false;
  }
}

/**
 * Main function to restructure all lessons
 */
async function restructureAllLessons() {
  try {
    console.log('🔄 Starting lesson restructuring...\n');
    console.log('This will restructure all lessons to follow:');
    console.log('  - Theory Section with Key Concepts');
    console.log('  - Interactive Examples with numbered walkthroughs');
    console.log('  - Deep Dive sections');
    console.log('  - Knowledge Check challenges\n');

    // Fetch all lessons
    const result = await pool.query(`
      SELECT l.id, l.title, l.content, c.slug as course_slug
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      ORDER BY c.slug, l.id
    `);

    if (result.rows.length === 0) {
      console.log('No lessons found in database.');
      return;
    }

    console.log(`Found ${result.rows.length} lessons to process.\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Group by course
    const lessonsByCourse = {};
    result.rows.forEach(lesson => {
      if (!lessonsByCourse[lesson.course_slug]) {
        lessonsByCourse[lesson.course_slug] = [];
      }
      lessonsByCourse[lesson.course_slug].push(lesson);
    });

    // Process each course
    for (const [courseSlug, lessons] of Object.entries(lessonsByCourse)) {
      console.log(`\n📚 Processing ${courseSlug.toUpperCase()} course (${lessons.length} lessons):`);
      
      for (const lesson of lessons) {
        console.log(`  Processing: "${lesson.title}" (ID: ${lesson.id})`);
        const updated = await updateLesson(lesson);
        
        if (updated === true) {
          updatedCount++;
        } else if (updated === false) {
          skippedCount++;
        } else {
          errorCount++;
        }
      }
    }

    console.log('\n\n📊 Summary:');
    console.log(`  ✓ Updated: ${updatedCount}`);
    console.log(`  - Skipped (already structured): ${skippedCount}`);
    console.log(`  ✗ Errors: ${errorCount}`);
    console.log(`  Total: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  restructureAllLessons().catch(console.error);
}

module.exports = { restructureAllLessons, restructureLessonContent };

