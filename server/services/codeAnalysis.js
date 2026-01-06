// Node.js 18+ has fetch built-in, no need to require node-fetch
// If you're using Node.js < 18, you'll need to install node-fetch

// Code Analysis Service configuration
const CODE_ANALYSIS_SERVICE_URL = process.env.CODE_ANALYSIS_SERVICE_URL || 'http://code-analysis:5001';

/**
 * Analyze code using the code analysis service
 * @param {string} code - The code to analyze
 * @param {string} language - Programming language
 * @param {string} lessonTitle - Current lesson title
 * @param {string} lessonTopic - Current lesson topic/subtopic
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeCodeWithOllama(code, language, lessonTitle, lessonTopic) {
  try {
    // Call the separate code analysis service with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 30000);
    });
    
    const fetchPromise = fetch(`${CODE_ANALYSIS_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        language: language,
        lessonTitle: lessonTitle,
        lessonTopic: lessonTopic
      })
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      throw new Error(`Code analysis service error: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Code analysis service error:', error);
      // Fallback to static analysis if service is unavailable
    return {
      success: false,
      error: error.message,
      fallback: analyzeCodeFallback(code, language, lessonTitle, lessonTopic)
    };
  }
}


/**
 * Get topic-specific analysis guidelines
 */
function getTopicSpecificGuidelines(lessonTitle, lessonTopic) {
  const topic = (lessonTopic || lessonTitle || '').toLowerCase();
  const guidelines = {
    strengths: [],
    improvements: [],
    bestPractices: [],
    checks: []
  };

  // Control Flow and Loops
  if (topic.includes('control flow') || topic.includes('loop') || topic.includes('if') || topic.includes('switch') || topic.includes('decision')) {
    guidelines.checks.push({
      pattern: /if\s*\(/,
      type: 'strength',
      message: 'Uses if statements correctly'
    });
    guidelines.checks.push({
      pattern: /else\s*{/,
      type: 'strength',
      message: 'Includes else clause for alternative paths'
    });
    guidelines.checks.push({
      pattern: /switch\s*\(/,
      type: 'strength',
      message: 'Uses switch statement appropriately'
    });
    guidelines.checks.push({
      pattern: /for\s*\(|while\s*\(/,
      type: 'strength',
      message: 'Implements loops correctly'
    });
    guidelines.improvements.push('Ensure all code paths are handled (consider else clauses)');
    guidelines.improvements.push('Check for potential infinite loops in while/for statements');
    guidelines.improvements.push('Use break statements appropriately in switch cases');
    guidelines.bestPractices.push('Use meaningful condition variable names (e.g., isValid, isReady)');
    guidelines.bestPractices.push('Keep conditions simple - extract complex logic to boolean variables');
    guidelines.bestPractices.push('Always include default case in switch statements');
  }

  // Data Types
  if (topic.includes('data type') || topic.includes('variable') || topic.includes('primitive')) {
    guidelines.checks.push({
      pattern: /(int|double|float|char|boolean|String)\s+\w+/,
      type: 'strength',
      message: 'Uses appropriate data types'
    });
    guidelines.improvements.push('Choose the most appropriate data type for the use case');
    guidelines.improvements.push('Consider using wrapper classes (Integer, Double) when needed');
    guidelines.bestPractices.push('Use descriptive variable names that indicate the data type purpose');
    guidelines.bestPractices.push('Initialize variables before use');
  }

  // Methods/Functions
  if (topic.includes('method') || topic.includes('function')) {
    guidelines.checks.push({
      pattern: /(public|private|protected)\s+\w+\s+\w+\s*\(/,
      type: 'strength',
      message: 'Defines methods with proper access modifiers'
    });
    guidelines.improvements.push('Methods should have a single responsibility');
    guidelines.improvements.push('Consider method parameters - avoid too many parameters');
    guidelines.bestPractices.push('Use descriptive method names (verb-based: calculateTotal, validateInput)');
    guidelines.bestPractices.push('Keep methods short and focused');
  }

  // Arrays
  if (topic.includes('array') || topic.includes('list')) {
    guidelines.checks.push({
      pattern: /\[\]\s*\w+|new\s+\w+\[/,
      type: 'strength',
      message: 'Uses arrays correctly'
    });
    guidelines.improvements.push('Check array bounds before accessing elements');
    guidelines.improvements.push('Consider using enhanced for loops when iterating');
    guidelines.bestPractices.push('Initialize arrays with appropriate size');
    guidelines.bestPractices.push('Use meaningful array variable names (plural: numbers, names)');
  }

  // Object-Oriented Programming
  if (topic.includes('class') || topic.includes('object') || topic.includes('oop')) {
    guidelines.checks.push({
      pattern: /class\s+\w+/,
      type: 'strength',
      message: 'Defines classes properly'
    });
    guidelines.improvements.push('Follow encapsulation - use private fields with public getters/setters');
    guidelines.improvements.push('Consider using constructors for initialization');
    guidelines.bestPractices.push('Class names should be nouns (PascalCase: Student, Car)');
    guidelines.bestPractices.push('Keep classes focused on a single responsibility');
  }

  return guidelines;
}

/**
 * Fallback analysis using static code analysis with context awareness
 */
async function analyzeCodeFallback(code, language, lessonTitle, lessonTopic) {
  const issues = [];
  const strengths = [];
  const improvements = [];
  const bestPractices = [];

  // Get topic-specific guidelines
  const topicGuidelines = getTopicSpecificGuidelines(lessonTitle, lessonTopic);
  
  // Basic static analysis
  const lines = code.split('\n');
  const codeLower = code.toLowerCase();
  
  // Check for common issues
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    // Check for long lines
    if (line.length > 120) {
      issues.push({
        type: 'warning',
        severity: 'low',
        line: lineNum,
        message: 'Line exceeds 120 characters',
        suggestion: 'Break into multiple lines for better readability'
      });
    }
    
    // Check for TODO/FIXME comments
    if (line.match(/TODO|FIXME|HACK/i)) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        line: lineNum,
        message: 'Contains TODO/FIXME comment',
        suggestion: 'Complete the implementation or remove the comment'
      });
    }

    // Check for empty catch blocks
    if (trimmedLine.match(/catch\s*\([^)]*\)\s*{?\s*}?$/)) {
      issues.push({
        type: 'error',
        severity: 'high',
        line: lineNum,
        message: 'Empty catch block',
        suggestion: 'Handle exceptions appropriately or log them'
      });
    }

    // Check for magic numbers
    if (trimmedLine.match(/[^a-zA-Z_]\d{3,}[^a-zA-Z_]/) && !trimmedLine.includes('//')) {
      issues.push({
        type: 'warning',
        severity: 'low',
        line: lineNum,
        message: 'Magic number detected',
        suggestion: 'Use named constants instead of hardcoded values'
      });
    }
  });

  // Topic-specific checks
  topicGuidelines.checks.forEach(check => {
    if (check.pattern.test(code)) {
      if (check.type === 'strength') {
        strengths.push(check.message);
      }
    }
  });

  // Language-specific detailed checks
  if (language.toLowerCase() === 'java') {
    // Check for proper class structure
    if (code.includes('public class') || code.includes('class ')) {
      strengths.push('Proper class structure with class declaration');
    } else if (code.trim().length > 50) {
      improvements.push('Consider organizing code into a class structure');
    }
    
    // Check for main method
    if (code.includes('public static void main')) {
      strengths.push('Has main method for execution');
    }
    
    // Check for proper brace usage
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    if (openBraces === closeBraces && openBraces > 0) {
      strengths.push('Proper brace matching and code structure');
    } else if (openBraces !== closeBraces) {
      issues.push({
        type: 'error',
        severity: 'high',
        line: null,
        message: `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`,
        suggestion: 'Check all opening and closing braces are properly matched'
      });
    }

    // Check for proper indentation (basic check)
    const indentedLines = lines.filter(line => line.trim() && (line.startsWith('    ') || line.startsWith('\t'))).length;
    if (indentedLines > lines.length * 0.5) {
      strengths.push('Good code indentation and formatting');
    } else if (lines.length > 5) {
      improvements.push('Improve code indentation for better readability');
    }

    // Check for variable naming
    const variableMatches = code.match(/\b(int|String|double|float|char|boolean)\s+([a-z][a-zA-Z0-9]*)\b/g);
    if (variableMatches && variableMatches.length > 0) {
      const goodNames = variableMatches.filter(m => {
        const varName = m.split(/\s+/)[1];
        return varName.length >= 3 && /^[a-z]/.test(varName);
      });
      if (goodNames.length === variableMatches.length) {
        strengths.push('Uses meaningful variable names following camelCase convention');
      } else {
        improvements.push('Use descriptive variable names (camelCase, at least 3 characters)');
      }
    }

    bestPractices.push('Use meaningful variable names that describe their purpose');
    bestPractices.push('Add JavaDoc comments for public methods and classes');
    bestPractices.push('Follow Java naming conventions: classes (PascalCase), variables (camelCase)');
    bestPractices.push('Keep methods focused on a single task');
    
    // Check for comments
    if (code.includes('//') || code.includes('/*')) {
      strengths.push('Code includes comments for documentation');
    } else if (code.split('\n').length > 10) {
      improvements.push('Add comments to explain complex logic and algorithm steps');
    }

    // Check for error handling
    if (code.includes('try') || code.includes('catch') || code.includes('throws')) {
      strengths.push('Includes error handling mechanisms');
    } else if (code.includes('Scanner') || code.includes('File') || code.includes('InputStream')) {
      improvements.push('Consider adding try-catch blocks for I/O operations');
    }

  } else if (language.toLowerCase() === 'python') {
    // Check for docstrings
    if (code.includes('"""') || code.includes("'''")) {
      strengths.push('Includes docstrings for documentation');
    } else if (code.includes('def ') || code.includes('class ')) {
      improvements.push('Add docstrings to functions and classes');
    }
    
    // Check for proper indentation
    const indentedLines = lines.filter(line => line.trim() && (line.startsWith('    ') || line.startsWith('\t'))).length;
    if (indentedLines > 0) {
      strengths.push('Proper Python indentation');
    }

    bestPractices.push('Follow PEP 8 style guide (4 spaces for indentation)');
    bestPractices.push('Use type hints where appropriate (Python 3.5+)');
    bestPractices.push('Use descriptive function and variable names (snake_case)');
    bestPractices.push('Keep functions small and focused');
  }

  // Add topic-specific improvements and best practices
  improvements.push(...topicGuidelines.improvements);
  bestPractices.push(...topicGuidelines.bestPractices);

  // General checks
  if (code.trim().length > 0) {
    strengths.push('Code is properly formatted and non-empty');
  }

  // Check code complexity (basic)
  const methodCount = (code.match(/\b(public|private|protected)?\s*\w+\s+\w+\s*\(/g) || []).length;
  if (methodCount > 0) {
    strengths.push(`Well-structured with ${methodCount} method(s)`);
  }

  // Calculate quality score
  const baseScore = 60;
  const scoreBonus = strengths.length * 4;
  const scorePenalty = issues.length * 5;
  const qualityScore = Math.min(100, Math.max(0, baseScore + scoreBonus - scorePenalty));

  // Create detailed summary
  const contextNote = lessonTopic ? `Analyzed in context of "${lessonTopic}"` : 
                     lessonTitle ? `Analyzed in context of "${lessonTitle}"` : '';
  
  const summary = `Code analysis ${contextNote ? `(${contextNote})` : ''}: Found ${issues.length} issue(s), ${strengths.length} strength(s). ` +
    `The code demonstrates ${strengths.length > 0 ? 'good' : 'basic'} structure and ${issues.length === 0 ? 'no major issues' : 'some areas for improvement'}. ` +
    `Quality score: ${qualityScore}/100. ${improvements.length > 0 ? 'Focus on the suggested improvements to enhance code quality.' : ''}`;

  return {
    quality_score: qualityScore,
    strengths: strengths.length > 0 ? strengths : ['Code structure is present'],
    issues: issues,
    improvements: improvements.length > 0 ? improvements : ['Review code for optimization opportunities'],
    best_practices: bestPractices.length > 0 ? bestPractices : ['Follow language-specific best practices'],
    summary: summary
  };
}

module.exports = {
  analyzeCodeWithOllama
};
