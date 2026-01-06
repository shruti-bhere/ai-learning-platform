/**
 * Script to remove all CODE_BLOCK placeholders from lesson content
 * and replace them with meaningful content based on context
 * 
 * Usage: node server/scripts/remove-code-block-placeholders.js
 */

const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'learning_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Intelligently replaces CODE_BLOCK placeholders based on context
 */
function replaceCodeBlocks(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let updatedContent = content;

  // First, extract comparison operator and value from code examples
  let operator = '>=';
  let compareValue = '60';
  const codeBlockMatch = content.match(/if\s*\(\s*\w+\s*(>=|<=|==|>|<|!=)\s*(\d+)\s*\)/);
  if (codeBlockMatch) {
    operator = codeBlockMatch[1];
    compareValue = codeBlockMatch[2];
  }

  // Pattern 1: Condition __CODE_BLOCK_0__ is CODE_BLOCK_1__ → "message"
  // Replace with: Condition [actual condition] is [true/false] → "message"
  updatedContent = updatedContent.replace(
    /Condition\s+__?CODE_BLOCK_0__?\s+is\s+__?CODE_BLOCK_1__?\s*→/gi,
    (match, offset) => {
      // Try to find the variable value from context (look backwards)
      const before = updatedContent.substring(Math.max(0, offset - 100), offset);
      const valueMatch = before.match(/(\w+)\s*=\s*(\d+)[\s\S]{0,50}Condition/);
      
      if (valueMatch) {
        const value = valueMatch[2];
        const condition = `${value} ${operator} ${compareValue}`;
        // Evaluate condition
        let result = 'true';
        try {
          const left = parseInt(value);
          const right = parseInt(compareValue);
          switch (operator) {
            case '>=':
              result = left >= right ? 'true' : 'false';
              break;
            case '<=':
              result = left <= right ? 'true' : 'false';
              break;
            case '==':
              result = left === right ? 'true' : 'false';
              break;
            case '>':
              result = left > right ? 'true' : 'false';
              break;
            case '<':
              result = left < right ? 'true' : 'false';
              break;
            case '!=':
              result = left !== right ? 'true' : 'false';
              break;
          }
        } catch (e) {
          // Keep default
        }
        return `Condition ${condition} is ${result} →`;
      }
      // Fallback: generic replacement
      return `Condition [value] ${operator} ${compareValue} is evaluated →`;
    }
  );

  // Pattern 2: __CODE_BLOCK_0__ (standalone, often in conditions)
  // Replace based on surrounding context
  updatedContent = updatedContent.replace(/__?CODE_BLOCK_0__?/g, (match, offset) => {
    // Check if it's in a condition context
    const before = updatedContent.substring(Math.max(0, offset - 50), offset);
    const after = updatedContent.substring(offset, Math.min(updatedContent.length, offset + 50));
    
    // If it's in "Condition ... is ..." pattern
    if (before.includes('Condition') || before.includes('condition')) {
      // Try to extract the actual condition
      const conditionMatch = before.match(/(\w+)\s*=\s*(\d+)/);
      const comparisonMatch = after.match(/(>=|<=|==|>|<|!=)\s*(\d+)/);
      if (conditionMatch && comparisonMatch) {
        const varName = conditionMatch[1];
        const value = conditionMatch[2];
        const operator = comparisonMatch[1];
        const compareValue = comparisonMatch[2];
        return `${value} ${operator} ${compareValue}`;
      }
      // Try to find comparison in before context
      const beforeComparison = before.match(/(>=|<=|==|>|<|!=)\s*(\d+)/);
      if (conditionMatch && beforeComparison) {
        const value = conditionMatch[2];
        const operator = beforeComparison[1];
        const compareValue = beforeComparison[2];
        return `${value} ${operator} ${compareValue}`;
      }
    }
    
    // If it's in a variable assignment context
    if (before.includes('=') && !before.includes('Condition')) {
      const varMatch = before.match(/(\w+)\s*=\s*(\d+)/);
      if (varMatch) {
        return varMatch[2]; // Return the value
      }
    }
    
    // Default: try to find a number or condition nearby
    const numberMatch = before.match(/(\d+)\s*(>=|<=|==|>|<|!=)\s*(\d+)/);
    if (numberMatch) {
      return `${numberMatch[1]} ${numberMatch[2]} ${numberMatch[3]}`;
    }
    
    // Last resort: remove the placeholder
    return '';
  });

  // Pattern 3: CODE_BLOCK_1__ (often true/false)
  updatedContent = updatedContent.replace(/__?CODE_BLOCK_1__?/g, (match, offset) => {
    const before = updatedContent.substring(Math.max(0, offset - 100), offset);
    const after = updatedContent.substring(offset, Math.min(updatedContent.length, offset + 100));
    
    // If it's after "is" in a condition context
    if (before.includes('is') && (before.includes('Condition') || before.includes('condition'))) {
      // Try to evaluate the condition
      const conditionMatch = before.match(/(\d+)\s*(>=|<=|==|>|<|!=)\s*(\d+)/);
      if (conditionMatch) {
        const left = parseInt(conditionMatch[1]);
        const operator = conditionMatch[2];
        const right = parseInt(conditionMatch[3]);
        let result = 'true';
        try {
          switch (operator) {
            case '>=':
              result = left >= right ? 'true' : 'false';
              break;
            case '<=':
              result = left <= right ? 'true' : 'false';
              break;
            case '==':
              result = left === right ? 'true' : 'false';
              break;
            case '>':
              result = left > right ? 'true' : 'false';
              break;
            case '<':
              result = left < right ? 'true' : 'false';
              break;
            case '!=':
              result = left !== right ? 'true' : 'false';
              break;
          }
        } catch (e) {
          // Keep default
        }
        return result;
      }
    }
    
    // Default: try to infer from context
    if (before.includes('true') || after.includes('true')) {
      return 'true';
    }
    if (before.includes('false') || after.includes('false')) {
      return 'false';
    }
    
    return 'true'; // Default
  });

  // Pattern 4: CODE_BLOCK_2, CODE_BLOCK_3, CODE_BLOCK_4, CODE_BLOCK_5, etc.
  // Replace with appropriate content based on position
  for (let i = 2; i <= 10; i++) {
    const regex = new RegExp(`__?CODE_BLOCK_${i}__?`, 'g');
    updatedContent = updatedContent.replace(regex, (match, offset) => {
      const before = updatedContent.substring(Math.max(0, offset - 50), offset);
      const after = updatedContent.substring(offset, Math.min(updatedContent.length, offset + 50));
      
      // Try to find context clues
      if (before.includes('if') || before.includes('condition')) {
        return 'the condition';
      }
      if (before.includes('print') || before.includes('output')) {
        return 'the message';
      }
      if (before.includes('variable') || before.includes('value')) {
        return 'the value';
      }
      
      // Remove if no context found
      return '';
    });
  }

  // Pattern 5: Remove any remaining CODE_BLOCK patterns
  updatedContent = updatedContent.replace(/__?CODE_BLOCK_\d+__?/g, '');

  // Clean up extra spaces and formatting
  updatedContent = updatedContent
    .replace(/\s+/g, ' ')  // Multiple spaces to single
    .replace(/\s*→\s*/g, ' → ')  // Normalize arrows
    .replace(/\s*:\s*/g, ': ')  // Normalize colons
    .trim();

  return updatedContent;
}

/**
 * Processes "Try Different Values" sections specifically
 */
function processTryDifferentValues(content) {
  // Pattern: score = 95: Condition __CODE_BLOCK_0__ is CODE_BLOCK_1__ → "message"
  const tryDifferentRegex = /(Try Different Values:[\s\S]*?)(?=\*\*|###|←|$)/i;
  
  return content.replace(tryDifferentRegex, (match) => {
    let processed = match;
    
    // First, try to find the comparison operator and value from the code examples in the content
    // Look for patterns like: if (score >= 60) or if (age >= 18)
    let operator = '>=';
    let compareValue = '60';
    const codeBlockMatch = content.match(/if\s*\(\s*\w+\s*(>=|<=|==|>|<|!=)\s*(\d+)\s*\)/);
    if (codeBlockMatch) {
      operator = codeBlockMatch[1];
      compareValue = codeBlockMatch[2];
    }
    
    // Replace each line in the "Try Different Values" section
    processed = processed.replace(
      /(\w+)\s*=\s*(\d+):\s*Condition\s+__?CODE_BLOCK_0__?\s+is\s+__?CODE_BLOCK_1__?\s*→\s*"([^"]+)"\s*prints([^]*?)(boundary case)?/gi,
      (lineMatch, varName, value, message, extra, boundary) => {
        const condition = `${value} ${operator} ${compareValue}`;
        
        // Evaluate the condition
        let result = 'true';
        try {
          const left = parseInt(value);
          const right = parseInt(compareValue);
          switch (operator) {
            case '>=':
              result = left >= right ? 'true' : 'false';
              break;
            case '<=':
              result = left <= right ? 'true' : 'false';
              break;
            case '==':
              result = left === right ? 'true' : 'false';
              break;
            case '>':
              result = left > right ? 'true' : 'false';
              break;
            case '<':
              result = left < right ? 'true' : 'false';
              break;
            case '!=':
              result = left !== right ? 'true' : 'false';
              break;
          }
        } catch (e) {
          // Keep default
        }
        
        const boundaryText = boundary ? ` (boundary case)` : '';
        return `${varName} = ${value}: Condition ${condition} is ${result} → "${message}" prints${boundaryText}`;
      }
    );
    
    // Also handle simpler patterns without quotes
    processed = processed.replace(
      /(\w+)\s*=\s*(\d+):\s*Condition\s+__?CODE_BLOCK_0__?\s+is\s+__?CODE_BLOCK_1__?\s*→\s*([^\n]+)/gi,
      (lineMatch, varName, value, message) => {
        const condition = `${value} ${operator} ${compareValue}`;
        
        // Evaluate
        let result = 'true';
        try {
          const left = parseInt(value);
          const right = parseInt(compareValue);
          switch (operator) {
            case '>=':
              result = left >= right ? 'true' : 'false';
              break;
            case '<=':
              result = left <= right ? 'true' : 'false';
              break;
            case '==':
              result = left === right ? 'true' : 'false';
              break;
            case '>':
              result = left > right ? 'true' : 'false';
              break;
            case '<':
              result = left < right ? 'true' : 'false';
              break;
            case '!=':
              result = left !== right ? 'true' : 'false';
              break;
          }
        } catch (e) {
          // Keep default
        }
        
        return `${varName} = ${value}: Condition ${condition} is ${result} → ${message}`;
      }
    );
    
    return processed;
  });
}

/**
 * Updates a single lesson's content
 */
async function updateLesson(lessonId, currentContent) {
  try {
    // Check for CODE_BLOCK in various formats (case-insensitive, with/without underscores)
    const hasCodeBlock = currentContent && (
      /CODE_BLOCK/i.test(currentContent) ||
      /__CODE_BLOCK/i.test(currentContent) ||
      /CODE_BLOCK__/i.test(currentContent)
    );
    
    if (!hasCodeBlock) {
      return false;
    }

    // Process the content
    let updatedContent = currentContent;
    
    // First, handle "Try Different Values" sections
    updatedContent = processTryDifferentValues(updatedContent);
    
    // Then, handle general CODE_BLOCK replacements
    updatedContent = replaceCodeBlocks(updatedContent);

    // Only update if content actually changed
    if (updatedContent !== currentContent) {
      await pool.query(
        'UPDATE lessons SET content = $1 WHERE id = $2',
        [updatedContent, lessonId]
      );
      console.log(`  ✓ Lesson ${lessonId}: Removed CODE_BLOCK placeholders`);
      console.log(`    Before: ${currentContent.substring(0, 100).replace(/\n/g, ' ')}...`);
      console.log(`    After:  ${updatedContent.substring(0, 100).replace(/\n/g, ' ')}...`);
      return true;
    } else {
      console.log(`  - Lesson ${lessonId}: No changes needed (placeholders may be in different format)`);
      // Show what was found
      const codeBlockMatch = currentContent.match(/CODE_BLOCK[^\s]*/i);
      if (codeBlockMatch) {
        console.log(`    Found pattern: ${codeBlockMatch[0]}`);
      }
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
    console.log('🔄 Starting CODE_BLOCK placeholder removal...\n');

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

module.exports = { updateAllLessons, updateLesson, replaceCodeBlocks, processTryDifferentValues };

