/**
 * StatusBar -- Bottom status strip (Bloomberg-style)
 */
import useGexStore from '../store/useGexStore';
import { Circle } from 'lucide-react';

export default function StatusBar() {
  const { repo, activeFile, runState, processedFiles, totalFiles } = useGexStore();
  const language = activeFile ? detectLang(activeFile) : null;

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <span className="statusbar-item">
          <span className="statusbar-dot green" />
          API Connected
        </span>

        {repo && (
          <span className="statusbar-item">
            {(repo.name || '').replace(/_gex$/, '')}
          </span>
        )}

        {runState !== 'idle' && (
          <span className="statusbar-item">
            {runState === 'running' && `Scanning ${processedFiles}/${totalFiles}`}
            {runState === 'completed' && 'Scan complete'}
            {runState === 'failed' && 'Scan failed'}
          </span>
        )}
      </div>

      <div className="statusbar-right">
        {language && (
          <span className="statusbar-item">{language}</span>
        )}

        {repo && (
          <span className="statusbar-item">{repo.file_count} files</span>
        )}

        <span className="statusbar-item">
          <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>_Gex</span>
          {' | '}
          <span style={{ color: 'var(--accent-cyan)' }}>Jenny</span>
        </span>

        <span className="statusbar-item" style={{ color: 'var(--text-dim)' }}>
          Powered by AiAssist
        </span>
      </div>
    </footer>
  );
}

function detectLang(path) {
  if (!path) return null;
  const ext = path.split('.').pop()?.toLowerCase();
  const map = {
    js: 'JavaScript', jsx: 'React JSX', ts: 'TypeScript', tsx: 'React TSX',
    py: 'Python', rs: 'Rust', go: 'Go', java: 'Java',
    css: 'CSS', html: 'HTML', json: 'JSON', md: 'Markdown',
    yml: 'YAML', yaml: 'YAML', toml: 'TOML', sql: 'SQL',
  };
  return map[ext] || ext?.toUpperCase() || null;
}
