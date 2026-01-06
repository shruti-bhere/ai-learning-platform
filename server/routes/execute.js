const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Directory to store temporary code files
const TEMP_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Execute code
router.post('/code', authenticate, async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'Code and language are required' });
    }

    const result = await executeCode(code, language);
    res.json(result);
  } catch (error) {
    console.error('Code execution error:', error);
    res.status(500).json({ error: 'Failed to execute code', message: error.message });
  }
});

async function executeCode(code, language) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const fileId = `${language}_${timestamp}_${randomId}`;

  let filename, command, cleanupCommand;

  switch (language.toLowerCase()) {
    case 'python':
      filename = `${fileId}.py`;
      command = `python3 ${path.join(TEMP_DIR, filename)}`;
      cleanupCommand = `rm ${path.join(TEMP_DIR, filename)}`;
      break;

    case 'java':
      // Auto-generate class name to avoid conflicts
      const className = `Main_${randomId}`;
      let javaCode = code.trim();
      
      // If code doesn't have a class declaration, wrap it
      if (!javaCode.includes('public class') && !javaCode.includes('class ')) {
        // User just wrote code without class - wrap it automatically
        const codeLines = javaCode.split('\n').map(line => '        ' + line).join('\n');
        javaCode = `public class ${className} {\n    public static void main(String[] args) {\n${codeLines}\n    }\n}`;
      } else if (javaCode.includes('public class')) {
        // Extract existing class name and replace to avoid conflicts
        const classMatch = javaCode.match(/public\s+class\s+(\w+)/);
        if (classMatch) {
          const originalClassName = classMatch[1];
          javaCode = javaCode.replace(new RegExp(`\\b${originalClassName}\\b`, 'g'), className);
        }
      } else if (javaCode.includes('class ')) {
        // Has class but not public - make it public and rename
        const classMatch = javaCode.match(/class\s+(\w+)/);
        if (classMatch) {
          const originalClassName = classMatch[1];
          javaCode = javaCode.replace(/class\s+\w+/, `public class ${className}`);
          javaCode = javaCode.replace(new RegExp(`\\b${originalClassName}\\b`, 'g'), className);
        }
      }
      
      // Ensure main method exists
      if (!javaCode.includes('public static void main')) {
        // Add main method if missing
        if (javaCode.includes('}')) {
          javaCode = javaCode.replace(/\}\s*$/, `    public static void main(String[] args) {\n        // Your code here\n    }\n}`);
        } else {
          javaCode += `\n    public static void main(String[] args) {\n        // Your code here\n    }\n}`;
        }
      }
      
      const javaFile = path.join(TEMP_DIR, `${className}.java`);
      fs.writeFileSync(javaFile, javaCode);
      
      // Compile and run in one command - user doesn't need to know about javac
      command = `cd ${TEMP_DIR} && javac ${className}.java 2>&1 && java ${className} 2>&1`;
      cleanupCommand = `cd ${TEMP_DIR} && rm -f ${className}.java ${className}.class 2>/dev/null`;
      break;

    case 'nodejs':
    case 'javascript':
    case 'js':
      filename = `${fileId}.js`;
      command = `node ${path.join(TEMP_DIR, filename)}`;
      cleanupCommand = `rm ${path.join(TEMP_DIR, filename)}`;
      break;

    case 'golang':
    case 'go':
      filename = `${fileId}.go`;
      const goFile = path.join(TEMP_DIR, filename);
      // Ensure package main and main function exist
      let goCode = code;
      if (!goCode.includes('package main')) {
        goCode = 'package main\n\n' + goCode;
      }
      if (!goCode.includes('func main()')) {
        // Wrap code in main function
        const lines = goCode.split('\n').filter(line => !line.trim().startsWith('package'));
        goCode = 'package main\n\nimport "fmt"\n\nfunc main() {\n\t' + lines.join('\n\t') + '\n}';
      }
      fs.writeFileSync(goFile, goCode);
      command = `cd ${TEMP_DIR} && go run ${filename} 2>&1`;
      cleanupCommand = `cd ${TEMP_DIR} && rm -f ${filename}`;
      break;

    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  // Write code to file
  if (language.toLowerCase() !== 'java' && language.toLowerCase() !== 'golang' && language.toLowerCase() !== 'go') {
    const filePath = path.join(TEMP_DIR, filename);
    fs.writeFileSync(filePath, code);
  }

  return new Promise((resolve, reject) => {
    const timeout = 10000; // 10 seconds timeout
    let timeoutId;

    const process = exec(command, {
      cwd: TEMP_DIR,
      timeout: timeout,
      maxBuffer: 1024 * 1024 * 10 // 10MB
    }, (error, stdout, stderr) => {
      clearTimeout(timeoutId);

      // Cleanup files
      exec(cleanupCommand, (cleanupError) => {
        if (cleanupError) {
          console.error('Cleanup error:', cleanupError);
        }
      });

      if (error) {
        // Check if it's a timeout
        if (error.signal === 'SIGTERM') {
          resolve({
            success: false,
            output: '',
            error: 'Execution timeout: Code took too long to execute (max 10 seconds)',
            exitCode: error.code || 1
          });
        } else {
          // For Java, combine compilation and runtime errors
          const errorOutput = stderr || error.message;
          const stdOutput = stdout || '';
          
          // If there's compilation error, show it clearly
          if (errorOutput.includes('error:') || errorOutput.includes('Exception')) {
            resolve({
              success: false,
              output: stdOutput,
              error: errorOutput,
              exitCode: error.code || 1
            });
          } else {
            resolve({
              success: false,
              output: stdOutput,
              error: errorOutput || 'Execution failed',
              exitCode: error.code || 1
            });
          }
        }
      } else {
        // Success - show output (stdout) and warnings (stderr) if any
        resolve({
          success: true,
          output: stdout || '',
          error: stderr || '', // Warnings go here
          exitCode: 0
        });
      }
    });

    // Set timeout
    timeoutId = setTimeout(() => {
      process.kill('SIGTERM');
    }, timeout);
  });
}

// Execute terminal command
router.post('/command', authenticate, async (req, res) => {
  try {
    const { command, language } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    // Sanitize command - only allow safe commands
    const safeCommands = ['ls', 'pwd', 'echo', 'cat', 'head', 'tail', 'grep', 'wc', 'date', 'whoami'];
    const commandParts = command.trim().split(/\s+/);
    const baseCommand = commandParts[0];

    // Allow language-specific commands
    const languageCommands = {
      python: ['python3', 'python', 'pip', 'pip3'],
      java: ['javac', 'java', 'javap'],
      nodejs: ['node', 'npm', 'npx'],
      golang: ['go', 'gofmt', 'goimports']
    };

    const allowedCommands = [
      ...safeCommands,
      ...(languageCommands[language?.toLowerCase()] || [])
    ];

    if (!allowedCommands.includes(baseCommand) && !command.startsWith('cd ')) {
      return res.json({
        success: false,
        output: '',
        error: `Command "${baseCommand}" is not allowed for security reasons. Allowed commands: ${allowedCommands.join(', ')}`
      });
    }

    const result = await executeCommand(command, language);
    res.json(result);
  } catch (error) {
    console.error('Command execution error:', error);
    res.status(500).json({ error: 'Failed to execute command', message: error.message });
  }
});

async function executeCommand(command, language) {
  return new Promise((resolve, reject) => {
    const timeout = 5000; // 5 seconds for commands
    let timeoutId;

    const process = exec(command, {
      cwd: TEMP_DIR,
      timeout: timeout,
      maxBuffer: 1024 * 1024 // 1MB
    }, (error, stdout, stderr) => {
      clearTimeout(timeoutId);

      if (error) {
        if (error.signal === 'SIGTERM') {
          resolve({
            success: false,
            output: '',
            error: 'Command timeout'
          });
        } else {
          resolve({
            success: false,
            output: stdout || '',
            error: stderr || error.message
          });
        }
      } else {
        resolve({
          success: true,
          output: stdout || '',
          error: stderr || ''
        });
      }
    });

    timeoutId = setTimeout(() => {
      process.kill('SIGTERM');
    }, timeout);
  });
}

module.exports = router;

