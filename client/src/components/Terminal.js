import React, { useState, useRef, useEffect } from 'react';
import './Terminal.css';

const Terminal = ({ output = '', onCommand, prompt = '$' }) => {
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output, commandHistory]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentCommand.trim() || currentCommand === 'clear') {
        const newHistory = [...commandHistory, currentCommand];
        setCommandHistory(newHistory);
        setHistoryIndex(-1);
        
        if (onCommand) {
          onCommand(currentCommand);
        }
        
        setCurrentCommand('');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    }
  };

  const clearTerminal = () => {
    setCommandHistory([]);
    setCurrentCommand('');
    setHistoryIndex(-1);
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-icon">💻</span>
          <span>Terminal</span>
        </div>
        <button className="clear-button" onClick={clearTerminal}>
          Clear
        </button>
      </div>
      <div className="terminal-body" ref={terminalRef}>
        {commandHistory.map((cmd, index) => (
          <div key={index} className="terminal-line">
            <span className="terminal-prompt">{prompt}</span>
            <span className="terminal-command">{cmd}</span>
          </div>
        ))}
        {output && (
          <div className="terminal-output">{output}</div>
        )}
        <div className="terminal-input-line">
          <span className="terminal-prompt">{prompt}</span>
          <input
            ref={inputRef}
            type="text"
            className="terminal-input"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            autoFocus
          />
        </div>
      </div>
    </div>
  );
};

export default Terminal;

