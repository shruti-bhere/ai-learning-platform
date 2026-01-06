import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import CodeEditor from './CodeEditor';
import './MarkdownContent.css';
import apiConfig from '../config/api';

const MarkdownContent = ({ content, courseSlug }) => {
  if (!content) return null;

  // Helper function to process inline markdown (bold, code, italic)
  const processInlineMarkdown = (text) => {
    if (!text) return '';
    
    // Escape HTML to prevent XSS
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Process inline code first (before bold/italic to avoid conflicts)
    // Match inline code with backticks: `code`
    // Store code blocks temporarily to avoid processing markdown inside them
    const codeBlocks = [];
    text = text.replace(/`([^`]+)`/g, (match, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(code);
      return placeholder;
    });
    
    // Process bold (**text** or __text__) - must be double asterisks/underscores
    text = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    
    // Restore code blocks
    codeBlocks.forEach((code, index) => {
      text = text.replace(`__CODE_BLOCK_${index}__`, `<code>${code}</code>`);
    });
    
    return text;
  };

  // Simple markdown parser for our use case
  const parseMarkdown = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let currentCodeBlock = null;
    let currentCode = [];
    let currentParagraph = [];
    let currentList = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        elements.push({
          type: 'paragraph',
          content: currentParagraph.join('\n')
        });
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push({
          type: 'list',
          items: currentList
        });
        currentList = [];
      }
    };

    const flushCodeBlock = () => {
      if (currentCode.length > 0) {
        elements.push({
          type: 'code',
          language: currentCodeBlock || 'text',
          content: currentCode.join('\n')
        });
        currentCode = [];
        currentCodeBlock = null;
      }
    };

    lines.forEach((line, index) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (currentCodeBlock) {
          flushCodeBlock();
        } else {
          flushParagraph();
          flushList();
          currentCodeBlock = line.substring(3).trim() || 'text';
        }
        return;
      }

      if (currentCodeBlock) {
        currentCode.push(line);
        return;
      }

      // Headers
      if (line.startsWith('# ')) {
        flushParagraph();
        flushList();
        elements.push({ type: 'h1', content: line.substring(2) });
        return;
      }
      if (line.startsWith('## ')) {
        flushParagraph();
        flushList();
        elements.push({ type: 'h2', content: line.substring(3) });
        return;
      }
      if (line.startsWith('### ')) {
        flushParagraph();
        flushList();
        elements.push({ type: 'h3', content: line.substring(4) });
        return;
      }

      // Lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        flushParagraph();
        currentList.push(line.substring(2));
        return;
      }

      // Empty line
      if (line.trim() === '') {
        flushParagraph();
        flushList();
        return;
      }

      // Regular text
      currentParagraph.push(line);
    });

    flushParagraph();
    flushList();
    flushCodeBlock();

    return elements;
  };

  const elements = parseMarkdown(content);

  return (
    <div className="markdown-content">
      {elements.map((element, index) => {
        switch (element.type) {
          case 'h1':
            return <h1 key={index}>{element.content}</h1>;
          case 'h2':
            return <h2 key={index}>{element.content}</h2>;
          case 'h3':
            return <h3 key={index}>{element.content}</h3>;
          case 'paragraph':
            return (
              <p 
                key={index} 
                dangerouslySetInnerHTML={{ 
                  __html: processInlineMarkdown(element.content)
                }} 
              />
            );
          case 'list':
            return (
              <ul key={index}>
                {element.items.map((item, itemIndex) => (
                  <li 
                    key={itemIndex}
                    dangerouslySetInnerHTML={{
                      __html: processInlineMarkdown(item)
                    }}
                  />
                ))}
              </ul>
            );
          case 'code':
            // Create a stable key based on content hash to prevent unnecessary remounts
            const contentHash = element.content.length + '-' + element.content.substring(0, 50).replace(/\s/g, '');
            return (
              <CodeBlockWithActions
                key={`code-${index}-${contentHash}`}
                code={element.content}
                language={element.language}
                courseSlug={courseSlug}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
};

// Code Block Component with Copy and Run buttons
const CodeBlockWithActions = ({ code: initialCode, language, courseSlug }) => {
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const prevInitialCodeRef = useRef(initialCode);
  const originalCodeRef = useRef(initialCode);

  // Sync code when initialCode changes - only remount if content actually changed
  useEffect(() => {
    if (prevInitialCodeRef.current !== initialCode) {
      setCode(initialCode);
      // Only force remount if content significantly changed (not just a re-render)
      if (prevInitialCodeRef.current && initialCode && 
          prevInitialCodeRef.current.trim() !== initialCode.trim()) {
        setEditorKey(prev => prev + 1);
      }
      prevInitialCodeRef.current = initialCode;
      originalCodeRef.current = initialCode;
    }
  }, [initialCode]);

  // Map markdown language to course slug language
  const getLanguageForExecution = () => {
    if (courseSlug) return courseSlug;
    
    // Fallback: try to detect from code block language
    const langMap = {
      'java': 'java',
      'python': 'python',
      'javascript': 'nodejs',
      'js': 'nodejs',
      'go': 'golang',
      'golang': 'golang'
    };
    return langMap[language?.toLowerCase()] || 'java';
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleRun = async () => {
    if (!code.trim()) {
      if (isMountedRef.current) {
        setOutput('Error: No code to execute');
        setShowOutput(true);
      }
      return;
    }

    if (!isMountedRef.current) return;

    setRunning(true);
    setShowOutput(true);
    setOutput('Executing code...\n');

    try {
      // axios.defaults.headers.common['Authorization'] is set globally in AuthContext
      const response = await axios.post(
        `${apiConfig.API_BASE}/execute/code`,
        {
          code: code,
          language: getLanguageForExecution()
        }
      );

      if (!isMountedRef.current) return;

      const result = response.data;
      let outputText = '';

      if (result.success) {
        outputText = result.output || 'Code executed successfully (no output)';
        if (result.error) {
          outputText += '\n\nWarnings:\n' + result.error;
        }
      } else {
        outputText = 'Error executing code:\n' + (result.error || 'Unknown error');
        if (result.output) {
          outputText += '\n\nOutput:\n' + result.output;
        }
      }

      setOutput(outputText);
    } catch (error) {
      if (!isMountedRef.current) return;
      const errorMessage = error.response?.data?.error || error.message || 'Failed to execute code';
      setOutput('Error: ' + errorMessage);
    } finally {
      if (isMountedRef.current) {
        setRunning(false);
      }
    }
  };

  // Determine if this code block should be runnable
  const isRunnable = () => {
    const execLanguage = getLanguageForExecution();
    const runnableLanguages = ['java', 'python', 'nodejs', 'golang'];
    return runnableLanguages.includes(execLanguage);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <div className="code-block-language">
          {language || 'code'}
        </div>
        <div className="code-block-actions">
          <button
            className="code-action-button copy-button"
            onClick={handleCopy}
            title="Copy code"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          {isRunnable() && (
            <button
              className="code-action-button run-button"
              onClick={handleRun}
              disabled={running}
              title="Run code"
            >
              {running ? '⏳ Running...' : '▶ Run'}
            </button>
          )}
          <button
            className="code-action-button"
            onClick={() => {
              // Clear the editor for a fresh attempt
              setCode('');
              setOutput('');
              setShowOutput(false);
              setEditorKey(prev => prev + 1);
            }}
            title="Try yourself with an empty editor"
          >
            ✏️ Try Yourself
          </button>
          <button
            className="code-action-button"
            onClick={() => {
              // Reset back to the original example code
              const original = originalCodeRef.current || '';
              setCode(original);
              setOutput('');
              setShowOutput(false);
              setEditorKey(prev => prev + 1);
            }}
            title="Reset to original example code"
          >
            ↻ Reset
          </button>
        </div>
      </div>
      <div className="code-editor-wrapper-inline">
        <CodeEditor
          key={editorKey}
          language={getLanguageForExecution()}
          initialValue={code}
          onCodeChange={setCode}
          readOnly={false}
          height="300px"
        />
      </div>
      {showOutput && output && (
        <div className="code-output">
          <div className="code-output-header">
            <span>Output</span>
            <button
              className="close-output-button"
              onClick={() => setShowOutput(false)}
              title="Close output"
            >
              ✕
            </button>
          </div>
          <pre className="code-output-content">{output}</pre>
        </div>
      )}
    </div>
  );
};

export default MarkdownContent;

