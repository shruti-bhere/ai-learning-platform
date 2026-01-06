/**
 * Script to update all lesson Solution/Walkthrough sections to the new format
 * 
 * Usage: node server/scripts/update-walkthrough-format.js
 */

const { Pool } = require('pg');
const { generateEnhancedWalkthrough } = require('../utils/codeWalkthroughGenerator');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'learning_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Extracts code blocks from markdown content
 */
function extractCodeBlocks(content) {
  const codeBlocks = [];
  const codeBlockRegex = /```(?:java)?\n?([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push(match[1].trim());
  }

  return codeBlocks;
}

/**
 * Finds and replaces old Solution/Walkthrough format with new format
 */
function updateWalkthroughSection(content, codeBlocks) {
  // Pattern to find Solution/Walkthrough sections
  const walkthroughRegex = /(\*\*Solution\/Walkthrough:\*\*[\s\S]*?)(?=\*\*|###|$)/i;
  
  // If no walkthrough section exists, we'll add one after the last code block
  if (!walkthroughRegex.test(content)) {
    // Find the last code block and add walkthrough after it
    const lastCodeBlockIndex = content.lastIndexOf('```');
    if (lastCodeBlockIndex !== -1) {
      const afterCodeBlock = content.indexOf('\n', lastCodeBlockIndex);
      if (afterCodeBlock !== -1 && codeBlocks.length > 0) {
        const newWalkthrough = generateEnhancedWalkthrough(codeBlocks[codeBlocks.length - 1]);
        return content.slice(0, afterCodeBlock + 1) + '\n' + newWalkthrough + '\n' + content.slice(afterCodeBlock + 1);
      }
    }
    return content;
  }

  // Replace existing walkthrough with new format
  return content.replace(walkthroughRegex, (match) => {
    // Use the last code block for generating walkthrough
    if (codeBlocks.length > 0) {
      return generateEnhancedWalkthrough(codeBlocks[codeBlocks.length - 1]);
    }
    return match; // Keep original if no code blocks found
  });
}

/**
 * Updates a single lesson's content
 */
async function updateLesson(lessonId, currentContent) {
  try {
    // Extract code blocks from content
    const codeBlocks = extractCodeBlocks(currentContent);
    
    if (codeBlocks.length === 0) {
      console.log(`  ⚠️  Lesson ${lessonId}: No code blocks found, skipping...`);
      return false;
    }

    // Update walkthrough section
    const updatedContent = updateWalkthroughSection(currentContent, codeBlocks);

    // Only update if content actually changed
    if (updatedContent !== currentContent) {
      await pool.query(
        'UPDATE lessons SET content = $1 WHERE id = $2',
        [updatedContent, lessonId]
      );
      console.log(`  ✓ Lesson ${lessonId}: Updated walkthrough format`);
      return true;
    } else {
      console.log(`  - Lesson ${lessonId}: No changes needed`);
      return false;
    }
  } catch (error) {
    console.error(`  ✗ Lesson ${lessonId}: Error - ${error.message}`);
    return false;
  }
}

/**
 * Main function to update all lessons
 */
async function updateAllLessons() {
  try {
    console.log('🔄 Starting walkthrough format update...\n');

    // Fetch all lessons
    const result = await pool.query('SELECT id, title, content FROM lessons ORDER BY id');

    if (result.rows.length === 0) {
      console.log('No lessons found in database.');
      return;
    }

    console.log(`Found ${result.rows.length} lessons to process.\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const lesson of result.rows) {
      console.log(`Processing: "${lesson.title}" (ID: ${lesson.id})`);
      const updated = await updateLesson(lesson.id, lesson.content);
      
      if (updated === true) {
        updatedCount++;
      } else if (updated === false && lesson.content) {
        skippedCount++;
      } else {
        errorCount++;
      }
      console.log('');
    }

    console.log('\n📊 Summary:');
    console.log(`  ✓ Updated: ${updatedCount}`);
    console.log(`  - Skipped: ${skippedCount}`);
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
  updateAllLessons().catch(console.error);
}

module.exports = { updateAllLessons, updateLesson };

