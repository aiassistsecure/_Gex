/**
 * CommandPalette -- Ctrl+K quick action overlay (no emojis)
 */
import { useState, useRef, useEffect } from 'react';
import useGexStore from '../store/useGexStore';
import {
  FolderOpen, Zap, Microscope, Monitor, Settings,
  Download, Trash2, Edit3
} from 'lucide-react';

const COMMANDS = [
  { id: 'load', label: 'Load Repository', Icon: FolderOpen, hint: 'Open a repo path' },
  { id: 'scan-file', label: 'Scan Current File', Icon: Zap, hint: 'Run Gex on active file' },
  { id: 'scan-repo', label: 'Scan Entire Repo', Icon: Microscope, hint: 'Full repo analysis' },
  { id: 'toggle-preview', label: 'Toggle Live Preview', Icon: Monitor, hint: 'Show/hide preview' },
  { id: 'settings', label: 'Open Settings', Icon: Settings, hint: 'Configure AI model' },
  { id: 'download', label: 'Download Patched ZIP', Icon: Download, hint: 'Export changes' },
  { id: 'clear-logs', label: 'Clear Logs', Icon: Trash2, hint: 'Reset log output' },
  { id: 'focus-editor', label: 'Focus Editor', Icon: Edit3, hint: 'Jump to editor' },
];

export default function CommandPalette({ onClose, onLoadRepo, onCLI }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (cmd) => {
    switch (cmd.id) {
      case 'settings':
        useGexStore.getState().setShowSettings(true);
        break;
      case 'clear-logs':
        useGexStore.getState().clearLogs();
        break;
      case 'load':
        document.querySelector('.titlebar .input')?.focus();
        break;
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      handleSelect(filtered[selectedIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="command-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="command-palette">
        <input
          ref={inputRef}
          className="command-input"
          placeholder="Type a command..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
          onKeyDown={handleKeyDown}
        />
        <div className="command-results">
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`command-item ${i === selectedIdx ? 'selected' : ''}`}
              onClick={() => handleSelect(cmd)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <span className="command-item-icon"><cmd.Icon size={15} /></span>
              <span>{cmd.label}</span>
              <span className="command-item-hint">{cmd.hint}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="command-item" style={{ color: 'var(--text-dim)', cursor: 'default' }}>
              No matching commands
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
