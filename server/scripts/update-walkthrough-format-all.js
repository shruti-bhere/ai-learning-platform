/**
 * Script to update all lessons to use the new walkthrough format:
 * - Remove bold asterisks (**)
 * - Remove "Line #" references
 * - Use natural language descriptions
 * - Replace CODE_BLOCK placeholders with actual code references
 * 
 * Usage: node server/scripts/update-walkthrough-format-all.js
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
 * Removes bold asterisks from text (more comprehensive)
 */
function removeBoldAsterisks(text) {
  if (!text) return text;
  // Remove **text** patterns but keep the text (multiple passes to catch nested)
  let cleaned = text;
  // Multiple passes to handle nested bold
  for (let i = 0; i < 5; i++) {
    cleaned = cleaned.replace(/\*\*([^*]+?)\*\*/g, '$1');
  }
  // Remove any remaining patterns
  cleaned = cleaned.replace(/\*\*([^*\n]+?)\*\*/g, '$1');
  // Remove bold from Solution/Walkthrough headers specifically
  cleaned = cleaned.replace(/\*\*Solution\/Walkthrough:\*\*/gi, 'Solution/Walkthrough:');
  cleaned = cleaned.replace(/\*\*Solution\/Walkthrough\*\*/gi, 'Solution/Walkthrough');
  cleaned = cleaned.replace(/\*\*Solution\/Walkthrough:?\*\*/gi, 'Solution/Walkthrough:');
  // Remove any remaining ** at start/end of lines in walkthrough sections
  cleaned = cleaned.replace(/(Solution\/Walkthrough:[\s\S]*?)(\*\*)/gi, '$1');
  return cleaned;
}

/**
 * Removes line number references like "Line 3:" or "Line 7:"
 */
function removeLineNumbers(text) {
  if (!text) return text;
  // Remove patterns like "Line 3:", "Line 7:", "Line 10:", etc.
  // Also handle variations like "Line 3", "line 3:", "LINE 3:", etc.
  let cleaned = text.replace(/Line\s+\d+:\s*/gi, '');
  cleaned = cleaned.replace(/Line\s+\d+\s*/gi, '');
  cleaned = cleaned.replace(/line\s+\d+:\s*/gi, '');
  cleaned = cleaned.replace(/LINE\s+\d+:\s*/gi, '');
  // Remove step numbers that reference lines like "Step 1 (Line 3):"
  cleaned = cleaned.replace(/\(Line\s+\d+\)/gi, '');
  return cleaned;
}

/**
 * Extracts code blocks from content and regenerates walkthroughs
 */
function updateWalkthroughSection(content) {
  if (!content) return content;

  let updatedContent = content;

  // First, remove ALL bold asterisks from the entire content (more aggressive)
  updatedContent = removeBoldAsterisks(updatedContent);
  
  // Remove ALL line number references
  updatedContent = removeLineNumbers(updatedContent);

  // Find all code blocks in the content
  const codeBlockRegex = /```(?:java|python|javascript|go)?\n([\s\S]*?)```/g;
  const allCodeBlocks = [];
  let codeMatch;
  
  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    allCodeBlocks.push({
      code: codeMatch[1],
      index: codeMatch.index,
      fullMatch: codeMatch[0]
    });
  }

  // Find Solution/Walkthrough sections (now without bold)
  const walkthroughRegex = /Solution\/Walkthrough:?\s*\n?([\s\S]*?)(?=###|##|Try It Yourself|$)/gi;
  const walkthroughMatches = [];
  let walkthroughMatch;
  
  while ((walkthroughMatch = walkthroughRegex.exec(updatedContent)) !== null) {
    walkthroughMatches.push({
      match: walkthroughMatch[0],
      index: walkthroughMatch.index,
      text: walkthroughMatch[1]
    });
  }

  // Process each walkthrough section
  for (let i = walkthroughMatches.length - 1; i >= 0; i--) {
    const wtMatch = walkthroughMatches[i];
    const matchIndex = wtMatch.index;
    
    // Find the code block closest before this walkthrough
    let closestCode = null;
    let closestDistance = Infinity;
    
    for (const codeBlock of allCodeBlocks) {
      if (codeBlock.index < matchIndex) {
        const distance = matchIndex - codeBlock.index;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestCode = codeBlock.code;
        }
      }
    }
    
    // Generate new walkthrough if we found code
    if (closestCode) {
      const newWalkthrough = generateWalkthrough(closestCode);
      updatedContent = updatedContent.substring(0, matchIndex) + 
                      newWalkthrough + 
                      updatedContent.substring(matchIndex + wtMatch.match.length);
    } else {
      // Clean up existing walkthrough and convert to numbered format
      let cleaned = wtMatch.text.trim();
      cleaned = removeLineNumbers(cleaned);
      cleaned = removeBoldAsterisks(cleaned);
      
      // Convert to numbered format if not already
      const lines = cleaned.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0 && !lines[0].match(/^\d+\./)) {
        cleaned = lines.map((line, idx) => {
          const cleanedLine = line.replace(/^\d+[\.\)]\s*/, '').trim();
          return `${idx + 1}. ${cleanedLine}`;
        }).join('\n\n');
      }
      
      const newWalkthrough = `Solution/Walkthrough:\n\n${cleaned}\n\n`;
      updatedContent = updatedContent.substring(0, matchIndex) + 
                      newWalkthrough + 
                      updatedContent.substring(matchIndex + wtMatch.match.length);
    }
  }

  // For code blocks without walkthroughs, add them
  // Look for code blocks that don't have a walkthrough section after them
  for (const codeBlock of allCodeBlocks) {
    const codeEndIndex = codeBlock.index + codeBlock.fullMatch.length;
    const afterCode = updatedContent.substring(codeEndIndex, codeEndIndex + 500);
    
    // Check if there's already a walkthrough nearby
    if (!afterCode.match(/Solution\/Walkthrough/i)) {
      // Generate walkthrough and insert it after the code block
      const newWalkthrough = generateWalkthrough(codeBlock.code);
      const insertPosition = codeEndIndex;
      updatedContent = updatedContent.substring(0, insertPosition) + 
                      '\n\n' + newWalkthrough + '\n\n' + 
                      updatedContent.substring(insertPosition);
    }
  }

  return updatedContent;
}

/**
 * Updates a single lesson's content
 */
async function updateLesson(lessonId, currentContent) {
  try {
    if (!currentContent) {
      return false;
    }

    // Process the content
    let updatedContent = updateWalkthroughSection(currentContent);

    // Only update if content actually changed
    if (updatedContent !== currentContent) {
      await pool.query(
        'UPDATE lessons SET content = $1 WHERE id = $2',
        [updatedContent, lessonId]
      );
      console.log(`  ✓ Lesson ${lessonId}: Updated walkthrough format`);
      return true;
    } else {
      console.log(`  - Lesson ${lessonId}: No walkthrough sections found or already updated`);
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
    console.log('This will:');
    console.log('  - Remove bold asterisks (**) from walkthroughs');
    console.log('  - Remove "Line #" references');
    console.log('  - Regenerate walkthroughs with natural language\n');

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
      } else if (updated === false) {
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

module.exports = { updateAllLessons, updateLesson, updateWalkthroughSection };

