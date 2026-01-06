const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5001;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'tinyllama:1.1b'; // Very lightweight model (~637MB)

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    const isOllamaAvailable = await checkOllamaAvailability();
    res.json({
      status: 'ok',
      ollama_available: isOllamaAvailable,
      model: OLLAMA_MODEL
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * Analyze code endpoint
 */
app.post('/analyze', async (req, res) => {
  try {
    const { code, language, lessonTitle, lessonTopic } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    const analysis = await analyzeCode(code, language, lessonTitle, lessonTopic);
    res.json(analysis);
  } catch (error) {
    console.error('Code analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze code',
      message: error.message
    });
  }
});

/**
 * Check if Ollama is available
 */
async function checkOllamaAvailability() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: controller.signal
    }).catch(() => null);
    
    clearTimeout(timeoutId);
    return response && response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Analyze code using Ollama or fallback
 */
async function analyzeCode(code, language, lessonTitle, lessonTopic) {
  try {
    const isOllamaAvailable = await checkOllamaAvailability();
    
    if (!isOllamaAvailable) {
      return {
        success: false,
        error: 'Ollama is not available',
        fallback: analyzeCodeFallback(code, language, lessonTitle, lessonTopic)
      };
    }

    const prompt = createAnalysisPrompt(code, language, lessonTitle, lessonTopic);
    const analysisResult = await callOllamaAPI(prompt);

    return {
      success: true,
      analysis: parseAnalysisResponse(analysisResult),
      model: OLLAMA_MODEL
    };
  } catch (error) {
    console.error('Ollama analysis error:', error);
    return {
      success: false,
      error: error.message,
      fallback: analyzeCodeFallback(code, language, lessonTitle, lessonTopic)
    };
  }
}

/**
 * Call Ollama API
 */
async function callOllamaAPI(prompt) {
  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        num_predict: 500, // Limit response length for lightweight model
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response || '';
}

/**
 * Create analysis prompt (simplified for lightweight model)
 */
function createAnalysisPrompt(code, language, lessonTitle, lessonTopic) {
  const context = lessonTopic ? `Current lesson topic: "${lessonTopic}"` : 
                 lessonTitle ? `Current lesson: "${lessonTitle}"` : '';
  
  return `Analyze this ${language} code${context ? ` in the context of ${context}` : ''}. Provide a brief JSON response:

{
  "quality_score": <0-100>,
  "strengths": ["strength1"],
  "issues": [{"type": "warning", "severity": "medium", "line": 1, "message": "issue", "suggestion": "fix"}],
  "improvements": ["improvement1"],
  "best_practices": ["practice1"],
  "summary": "brief summary"
}

Code:
\`\`\`${language}
${code.substring(0, 2000)}
\`\`\`

${context ? `Focus on how the code relates to ${context}. ` : ''}JSON only:`;
}

/**
 * Parse analysis response
 */
function parseAnalysisResponse(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      quality_score: 75,
      strengths: ['Code structure looks reasonable'],
      issues: [],
      improvements: ['Review code for improvements'],
      best_practices: ['Follow language conventions'],
      summary: response.substring(0, 300)
    };
  } catch (error) {
    return {
      quality_score: 70,
      strengths: [],
      issues: [],
      improvements: [],
      best_practices: [],
      summary: response.substring(0, 300)
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
      message: 'Uses if statements correctly for decision making'
    });
    guidelines.checks.push({
      pattern: /else\s*{/,
      type: 'strength',
      message: 'Includes else clause for alternative execution paths'
    });
    guidelines.checks.push({
      pattern: /switch\s*\(/,
      type: 'strength',
      message: 'Uses switch statement for multiple condition handling'
    });
    guidelines.checks.push({
      pattern: /for\s*\(|while\s*\(/,
      type: 'strength',
      message: 'Implements loops correctly for iteration'
    });
    guidelines.improvements.push('Ensure all code paths are handled (consider else clauses for completeness)');
    guidelines.improvements.push('Check for potential infinite loops - ensure loop conditions will eventually become false');
    guidelines.improvements.push('Use break statements appropriately in switch cases to prevent fall-through');
    guidelines.improvements.push('Consider using enhanced for loops when iterating over collections');
    guidelines.bestPractices.push('Use meaningful condition variable names (e.g., isValid, isReady, hasPermission)');
    guidelines.bestPractices.push('Keep conditions simple - extract complex logic to boolean variables for readability');
    guidelines.bestPractices.push('Always include default case in switch statements for error handling');
    guidelines.bestPractices.push('Use proper indentation to show nested control structures clearly');
  }

  // Data Types
  if (topic.includes('data type') || topic.includes('variable') || topic.includes('primitive')) {
    guidelines.checks.push({
      pattern: /(int|double|float|char|boolean|String)\s+\w+/,
      type: 'strength',
      message: 'Uses appropriate data types for variables'
    });
    guidelines.improvements.push('Choose the most appropriate data type for the use case (e.g., int vs long, float vs double)');
    guidelines.improvements.push('Consider using wrapper classes (Integer, Double) when object behavior is needed');
    guidelines.improvements.push('Initialize variables before use to avoid compilation errors');
    guidelines.bestPractices.push('Use descriptive variable names that indicate the data type purpose');
    guidelines.bestPractices.push('Follow naming conventions: camelCase for variables, UPPER_CASE for constants');
    guidelines.bestPractices.push('Choose appropriate precision (float vs double) based on requirements');
  }

  // Methods/Functions
  if (topic.includes('method') || topic.includes('function')) {
    guidelines.checks.push({
      pattern: /(public|private|protected)\s+\w+\s+\w+\s*\(/,
      type: 'strength',
      message: 'Defines methods with proper access modifiers'
    });
    guidelines.improvements.push('Methods should have a single responsibility - split complex methods');
    guidelines.improvements.push('Consider method parameters - avoid too many parameters (use objects if needed)');
    guidelines.improvements.push('Add return type annotations and parameter validation');
    guidelines.bestPractices.push('Use descriptive method names (verb-based: calculateTotal, validateInput, processData)');
    guidelines.bestPractices.push('Keep methods short and focused (ideally under 20-30 lines)');
    guidelines.bestPractices.push('Document method purpose, parameters, and return values with JavaDoc');
  }

  // Arrays
  if (topic.includes('array') || topic.includes('list')) {
    guidelines.checks.push({
      pattern: /\[\]\s*\w+|new\s+\w+\[/,
      type: 'strength',
      message: 'Uses arrays correctly for data storage'
    });
    guidelines.improvements.push('Check array bounds before accessing elements to prevent ArrayIndexOutOfBoundsException');
    guidelines.improvements.push('Consider using enhanced for loops when iterating over arrays');
    guidelines.improvements.push('Initialize arrays with appropriate size or use dynamic collections (ArrayList)');
    guidelines.bestPractices.push('Use meaningful array variable names (plural: numbers, names, students)');
    guidelines.bestPractices.push('Consider ArrayList for dynamic sizing when size is unknown');
    guidelines.bestPractices.push('Use Arrays.toString() for debugging array contents');
  }

  // Object-Oriented Programming
  if (topic.includes('class') || topic.includes('object') || topic.includes('oop')) {
    guidelines.checks.push({
      pattern: /class\s+\w+/,
      type: 'strength',
      message: 'Defines classes properly for object-oriented design'
    });
    guidelines.improvements.push('Follow encapsulation - use private fields with public getters/setters');
    guidelines.improvements.push('Consider using constructors for proper object initialization');
    guidelines.improvements.push('Implement equals() and hashCode() methods when needed');
    guidelines.bestPractices.push('Class names should be nouns in PascalCase (Student, Car, BankAccount)');
    guidelines.bestPractices.push('Keep classes focused on a single responsibility (Single Responsibility Principle)');
    guidelines.bestPractices.push('Use access modifiers appropriately (private, protected, public)');
  }

  return guidelines;
}

/**
 * Fallback static analysis with context awareness
 */
function analyzeCodeFallback(code, language, lessonTitle, lessonTopic) {
  const issues = [];
  const strengths = [];
  const improvements = [];
  const bestPractices = [];

  // Get topic-specific guidelines
  const topicGuidelines = getTopicSpecificGuidelines(lessonTitle, lessonTopic);
  
  const lines = code.split('\n');
  const codeLower = code.toLowerCase();
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();
    
    if (line.length > 120) {
      issues.push({
        type: 'warning',
        severity: 'low',
        line: lineNum,
        message: 'Line exceeds 120 characters',
        suggestion: 'Break into multiple lines for better readability'
      });
    }
    
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
        suggestion: 'Handle exceptions appropriately or log them for debugging'
      });
    }

    // Check for magic numbers
    if (trimmedLine.match(/[^a-zA-Z_]\d{3,}[^a-zA-Z_]/) && !trimmedLine.includes('//')) {
      issues.push({
        type: 'warning',
        severity: 'low',
        line: lineNum,
        message: 'Magic number detected',
        suggestion: 'Use named constants instead of hardcoded values (e.g., MAX_SIZE = 100)'
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

  if (language.toLowerCase() === 'java') {
    if (code.includes('public class') || code.includes('class ')) {
      strengths.push('Proper class structure with class declaration');
    } else if (code.trim().length > 50) {
      improvements.push('Consider organizing code into a class structure');
    }
    
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
        improvements.push('Use descriptive variable names (camelCase, at least 3 characters, start with lowercase)');
      }
    }

    bestPractices.push('Use meaningful variable names that describe their purpose');
    bestPractices.push('Add JavaDoc comments for public methods and classes');
    bestPractices.push('Follow Java naming conventions: classes (PascalCase), variables (camelCase), constants (UPPER_CASE)');
    bestPractices.push('Keep methods focused on a single task');
    
    if (code.includes('//') || code.includes('/*')) {
      strengths.push('Code includes comments for documentation');
    } else if (code.split('\n').length > 10) {
      improvements.push('Add comments to explain complex logic and algorithm steps');
    }

    if (code.includes('try') || code.includes('catch') || code.includes('throws')) {
      strengths.push('Includes error handling mechanisms');
    } else if (code.includes('Scanner') || code.includes('File') || code.includes('InputStream')) {
      improvements.push('Consider adding try-catch blocks for I/O operations to handle exceptions');
    }

  } else if (language.toLowerCase() === 'python') {
    if (code.includes('"""') || code.includes("'''")) {
      strengths.push('Includes docstrings for documentation');
    } else if (code.includes('def ') || code.includes('class ')) {
      improvements.push('Add docstrings to functions and classes');
    }
    
    const indentedLines = lines.filter(line => line.trim() && (line.startsWith('    ') || line.startsWith('\t'))).length;
    if (indentedLines > 0) {
      strengths.push('Proper Python indentation');
    }

    bestPractices.push('Follow PEP 8 style guide (4 spaces for indentation, not tabs)');
    bestPractices.push('Use type hints where appropriate (Python 3.5+)');
    bestPractices.push('Use descriptive function and variable names (snake_case)');
    bestPractices.push('Keep functions small and focused');
  }

  // Add topic-specific improvements and best practices
  improvements.push(...topicGuidelines.improvements);
  bestPractices.push(...topicGuidelines.bestPractices);

  if (code.trim().length > 0) {
    strengths.push('Code is properly formatted and non-empty');
  }

  const methodCount = (code.match(/\b(public|private|protected)?\s*\w+\s+\w+\s*\(/g) || []).length;
  if (methodCount > 0) {
    strengths.push(`Well-structured with ${methodCount} method(s) defined`);
  }

  const baseScore = 60;
  const scoreBonus = strengths.length * 4;
  const scorePenalty = issues.length * 5;
  const qualityScore = Math.min(100, Math.max(0, baseScore + scoreBonus - scorePenalty));

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

app.listen(PORT, () => {
  console.log(`Code Analysis Service running on port ${PORT}`);
  console.log(`Using model: ${OLLAMA_MODEL}`);
  console.log(`Ollama host: ${OLLAMA_HOST}`);
});
