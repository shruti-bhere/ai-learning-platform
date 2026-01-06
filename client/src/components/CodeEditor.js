import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import './CodeEditor.css';

const CodeEditor = ({ language = 'javascript', initialValue = '', onCodeChange, readOnly = false, height = '400px' }) => {
  const [code, setCode] = useState(initialValue);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMountedRef.current) {
      setCode(initialValue);
    }
  }, [initialValue]);

  const handleEditorChange = (value) => {
    if (!isMountedRef.current) return;
    setCode(value || '');
    if (onCodeChange) {
      onCodeChange(value || '');
    }
  };

  const languageMap = {
    java: 'java',
    python: 'python',
    nodejs: 'javascript',
    golang: 'go',
    javascript: 'javascript',
    go: 'go'
  };

  const editorLanguage = languageMap[language.toLowerCase()] || 'javascript';

  if (!isMountedRef.current) {
    return null;
  }

  return (
    <div className="code-editor-container">
      <div className="code-editor-header">
        <span className="editor-language">{editorLanguage.toUpperCase()}</span>
        {!readOnly && (
          <div className="editor-actions">
            <button 
              className="run-button"
              onClick={() => {
                // This will be handled by parent component
                if (onCodeChange) {
                  onCodeChange(code);
                }
              }}
            >
              ▶ Run Code
            </button>
            <button 
              className="reset-button"
              onClick={() => {
                setCode(initialValue);
                if (onCodeChange) {
                  onCodeChange(initialValue);
                }
              }}
            >
              ↻ Reset
            </button>
          </div>
        )}
      </div>
      <Editor
        height={height}
        language={editorLanguage}
        value={code}
        onChange={handleEditorChange}
        theme="vs-dark"
        loading={<div style={{ padding: '20px', textAlign: 'center' }}>Loading editor...</div>}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          readOnly: readOnly,
          wordWrap: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          selectOnLineNumbers: true,
          roundedSelection: false,
          cursorStyle: 'line',
          fontFamily: "'Fira Code', 'Courier New', monospace",
          fontLigatures: true
        }}
      />
    </div>
  );
};

export default CodeEditor;

