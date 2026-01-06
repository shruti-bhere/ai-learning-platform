/**
 * Code Walkthrough Generator
 * Generates natural, step-by-step explanations for Java code
 * Format: Clean, numbered walkthrough without line numbers or bold asterisks
 */

/**
 * Analyzes Java code and generates a natural step-by-step walkthrough
 * @param {string} code - The Java code to analyze
 * @param {string} context - Optional context about what the code does
 * @returns {string} - Formatted markdown walkthrough
 */
function generateWalkthrough(code, context = '') {
  if (!code || typeof code !== 'string') {
    return '';
  }

  const lines = code.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const steps = [];
  let variables = {};
  let inIfBlock = false;
  let inElseBlock = false;
  let ifCondition = null;
  let ifConditionResult = null;
  let ifConditionText = null;
  let hasPrintedBeforeCondition = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments and empty lines
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }

    // Variable declaration and initialization
    if (line.match(/^\s*(int|String|double|float|boolean|char|long|byte|short)\s+\w+\s*=/)) {
      const match = line.match(/(\w+)\s+(\w+)\s*=\s*(.+?);?$/);
      if (match) {
        const type = match[1];
        const varName = match[2];
        const value = match[3].replace(/;$/, '').trim();
        variables[varName] = { type, value };
        
        steps.push({
          text: `The program initializes the ${varName} variable and sets its value to ${value}.`
        });
      }
    }
    // System.out.println statements (before conditionals)
    else if (!inIfBlock && !inElseBlock && line.includes('System.out.println')) {
      const match = line.match(/System\.out\.println\((.+?)\)/);
      if (match) {
        let output = match[1];
        // Replace variables with their values for context
        Object.keys(variables).forEach(varName => {
          const varValue = variables[varName].value;
          output = output.replace(new RegExp(varName, 'g'), varValue);
        });
        // Clean up quotes and concatenation
        output = output.replace(/["']/g, '').replace(/\s*\+\s*/g, ' ').trim();
        
        hasPrintedBeforeCondition = true;
        
        // Determine context-aware message
        const varName = Object.keys(variables)[0] || 'value';
        if (output.includes('age') || output.includes('checking') || output.includes('current') || output.includes(varName)) {
          steps.push({
            text: `A message is printed to the console to display the ${varName} being checked.`
          });
        } else {
          steps.push({
            text: `A message is printed to the console: "${output}".`
          });
        }
      }
    }
    // If statement
    else if (line.match(/^\s*if\s*\(/)) {
      const match = line.match(/if\s*\((.+?)\)/);
      if (match) {
        ifCondition = match[1];
        inIfBlock = true;
        inElseBlock = false;
        
        // Replace variables in condition with their values
        let conditionText = ifCondition;
        Object.keys(variables).forEach(varName => {
          const varValue = variables[varName].value;
          conditionText = conditionText.replace(new RegExp(varName, 'g'), varValue);
        });
        ifConditionText = conditionText;
        
        // Try to evaluate condition for common patterns
        if (conditionText.match(/\d+\s*>=\s*\d+/)) {
          const evalMatch = conditionText.match(/(\d+)\s*>=\s*(\d+)/);
          if (evalMatch) {
            const left = parseInt(evalMatch[1]);
            const right = parseInt(evalMatch[2]);
            ifConditionResult = left >= right;
          }
        } else if (conditionText.match(/\d+\s*<=\s*\d+/)) {
          const evalMatch = conditionText.match(/(\d+)\s*<=\s*(\d+)/);
          if (evalMatch) {
            const left = parseInt(evalMatch[1]);
            const right = parseInt(evalMatch[2]);
            ifConditionResult = left <= right;
          }
        } else if (conditionText.match(/\d+\s*==\s*\d+/)) {
          const evalMatch = conditionText.match(/(\d+)\s*==\s*(\d+)/);
          if (evalMatch) {
            const left = parseInt(evalMatch[1]);
            const right = parseInt(evalMatch[2]);
            ifConditionResult = left === right;
          }
        } else if (conditionText.match(/\d+\s*>\s*\d+/)) {
          const evalMatch = conditionText.match(/(\d+)\s*>\s*(\d+)/);
          if (evalMatch) {
            const left = parseInt(evalMatch[1]);
            const right = parseInt(evalMatch[2]);
            ifConditionResult = left > right;
          }
        } else if (conditionText.match(/\d+\s*<\s*\d+/)) {
          const evalMatch = conditionText.match(/(\d+)\s*<\s*(\d+)/);
          if (evalMatch) {
            const left = parseInt(evalMatch[1]);
            const right = parseInt(evalMatch[2]);
            ifConditionResult = left < right;
          }
        }
        
        // Build natural language condition
        const varName = Object.keys(variables)[0] || 'value';
        const varValue = variables[varName]?.value || '';
        
        // Simplify common patterns
        let conditionDescription = '';
        if (ifCondition.includes('>=')) {
          const threshold = ifCondition.match(/>=\s*(\d+)/)?.[1] || '';
          conditionDescription = `to see if the ${varName} is greater than or equal to ${threshold}`;
        } else if (ifCondition.includes('<=')) {
          const threshold = ifCondition.match(/<=\s*(\d+)/)?.[1] || '';
          conditionDescription = `to see if the ${varName} is less than or equal to ${threshold}`;
        } else if (ifCondition.includes('==')) {
          const threshold = ifCondition.match(/==\s*(\d+)/)?.[1] || '';
          conditionDescription = `to see if the ${varName} is equal to ${threshold}`;
        } else if (ifCondition.includes('>')) {
          const threshold = ifCondition.match(/>\s*(\d+)/)?.[1] || '';
          conditionDescription = `to see if the ${varName} is greater than ${threshold}`;
        } else if (ifCondition.includes('<')) {
          const threshold = ifCondition.match(/<\s*(\d+)/)?.[1] || '';
          conditionDescription = `to see if the ${varName} is less than ${threshold}`;
        } else {
          // Generic condition
          conditionDescription = `the condition: ${ifCondition.replace(/\w+/g, (match) => variables[match] ? variables[match].value : match)}`;
        }
        
        let conditionStep = `The system evaluates the condition ${conditionDescription}.`;
        if (ifConditionResult !== null) {
          conditionStep += ` Since the condition is ${ifConditionResult ? 'true' : 'false'}, the program ${ifConditionResult ? 'executes the code inside the block' : 'skips the if block'}.`;
        }
        
        steps.push({
          text: conditionStep
        });
      }
    }
    // Else statement
    else if (line.match(/^\s*else\s*\{?/)) {
      inElseBlock = true;
      inIfBlock = false;
      
      steps.push({
        text: `Since the previous condition was false, the program now executes the alternative code block.`
      });
    }
    // Code inside if block (print statements)
    else if (inIfBlock && line.includes('System.out.println')) {
      const match = line.match(/System\.out\.println\((.+?)\)/);
      if (match) {
        let output = match[1].replace(/["']/g, '').replace(/\s*\+\s*/g, ' ').trim();
        
        // Only add this step if condition is true (we evaluated it earlier)
        if (ifConditionResult === true || ifConditionResult === null) {
          // Determine what was printed
          let printDescription = '';
          if (output.includes('adult') || output.includes('passed') || output.includes('permission') || output.includes('Congratulations')) {
            if (output.includes('passed') || output.includes('Congratulations')) {
              printDescription = `printing "${output}"`;
            } else {
              printDescription = `printing the adult confirmation and ${output.includes('voting') || output.includes('permission') ? 'voting permissions' : 'relevant information'}`;
            }
          } else {
            printDescription = `printing "${output}"`;
          }
          
          steps.push({
            text: `Since the condition is true, the program executes the code inside the block, ${printDescription}.`
          });
        }
      }
    }
    // Code inside else block
    else if (inElseBlock && line.includes('System.out.println')) {
      const match = line.match(/System\.out\.println\((.+?)\)/);
      if (match) {
        let output = match[1].replace(/["']/g, '').replace(/\s*\+\s*/g, ' ').trim();
        
        // Only add this step if condition is false (we evaluated it earlier)
        if (ifConditionResult === false || ifConditionResult === null) {
          steps.push({
            text: `Since the condition was false, the program executes the else block, printing "${output}".`
          });
        }
      }
    }
    // Closing braces for if/else
    else if (line === '}' && (inIfBlock || inElseBlock)) {
      inIfBlock = false;
      inElseBlock = false;
      
      // After if/else block closes, check for final print statements
      // Look ahead for print statements that are outside the block
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.includes('System.out.println')) {
          const match = nextLine.match(/System\.out\.println\((.+?)\)/);
          if (match) {
            let output = match[1].replace(/["']/g, '').replace(/\s*\+\s*/g, ' ').trim();
            
            if (output.includes('complete') || output.includes('finished') || output.includes('---')) {
              if (output.includes('---')) {
                steps.push({
                  text: `A separator line is printed to the console.`
                });
              } else {
                steps.push({
                  text: `A message "${output}" is printed to the console. This executes regardless of the condition because it is outside the if-statement block.`
                });
              }
              break; // Only add the first final statement
            }
          }
        } else if (nextLine.trim() && !nextLine.startsWith('//')) {
          // Non-comment, non-print line - stop looking
          break;
        }
      }
    }
    // Print statements outside conditional blocks (final statements) - handle after if/else closes
    // This is handled in the closing brace section
    // Variable assignment (not initialization)
    else if (line.match(/^\s*\w+\s*=\s*.+;?/) && !line.match(/^\s*(int|String|double|float|boolean|char|long|byte|short)\s/)) {
      const match = line.match(/(\w+)\s*=\s*(.+?);?$/);
      if (match) {
        const varName = match[1];
        const value = match[2].replace(/;$/, '').trim();
        
        if (variables[varName]) {
          variables[varName].value = value;
        }
        
        steps.push({
          text: `The program updates the ${varName} variable to ${value}.`
        });
      }
    }
    // Loop statements
    else if (line.match(/^\s*(for|while|do)\s*\(/)) {
      const match = line.match(/(for|while|do)\s*\((.+?)\)/);
      if (match) {
        const loopType = match[1];
        const condition = match[2];
        
        steps.push({
          text: `The program begins a ${loopType} loop that will repeat as long as ${condition} is true.`
        });
      }
    }
  }

  // Format as clean markdown without bold or line numbers
  if (steps.length === 0) {
    return 'Solution/Walkthrough:\n\nUnable to generate walkthrough from the provided code.\n';
  }

  let markdown = 'Solution/Walkthrough:\n\n';
  
  // Format as numbered list (1, 2, 3...)
  steps.forEach((step, index) => {
    markdown += `${index + 1}. ${step.text}\n\n`;
  });

  return markdown;
}

/**
 * Enhanced walkthrough generator with more context-aware explanations
 * @param {string} code - The Java code to analyze
 * @param {Object} options - Additional options for customization
 * @returns {string} - Formatted markdown walkthrough
 */
function generateEnhancedWalkthrough(code, options = {}) {
  // Use the main generator for consistency
  return generateWalkthrough(code, options.context || '');
}

module.exports = {
  generateWalkthrough,
  generateEnhancedWalkthrough
};
