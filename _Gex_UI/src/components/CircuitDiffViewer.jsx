/**
 * CircuitDiffViewer v1.0.0 — Bloomberg-style diff hunk cards
 */
import useGexStore from '../store/useGexStore';
import { useState } from 'react';

export default function CircuitDiffViewer() {
  const { lastResult } = useGexStore();

  if (!lastResult?.diff?.hunks?.length) {
    return null;
  }

  const { hunks, total_additions, total_deletions } = lastResult.diff;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
        <span className="panel-label">Diff Hunks</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)' }}>
          <span style={{ color: 'var(--accent-green)' }}>+{total_additions}</span>
          {' / '}
          <span style={{ color: 'var(--accent-red)' }}>-{total_deletions}</span>
        </span>
      </div>

      {hunks.map((hunk, idx) => (
        <HunkCard key={idx} hunk={hunk} index={idx} />
      ))}
    </div>
  );
}

function HunkCard({ hunk, index }) {
  const [expanded, setExpanded] = useState(true);

  const typeColor = {
    modification: 'var(--accent-orange)',
    addition: 'var(--accent-green)',
    deletion: 'var(--accent-red)',
  }[hunk.type] || 'var(--text-dim)';

  return (
    <div className="diff-hunk">
      <div className="diff-hunk-header" onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer' }}>
        <span>
          <span style={{ color: typeColor, fontWeight: 600 }}>
            {hunk.type?.toUpperCase()}
          </span>
          {' '}
          <span>L{hunk.start}–L{hunk.end}</span>
        </span>
        <span>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="diff-hunk-body">
          {hunk.before_lines?.map((line, i) => (
            <div key={`r-${i}`} className="diff-line removed">- {line}</div>
          ))}
          {hunk.after_lines?.map((line, i) => (
            <div key={`a-${i}`} className="diff-line added">+ {line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
