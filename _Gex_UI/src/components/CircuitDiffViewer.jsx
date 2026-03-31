/**
 * CircuitDiffViewer v1.0.0 -- Bloomberg-style diff hunk cards
 * Allows users to review and safely apply AI patches directly to workspace code.
 */
import { useState, useEffect } from 'react';
import useGexStore from '../store/useGexStore';
import { applyPatches } from '../services/api';
import { CheckCircle2, Play, CheckCheck } from 'lucide-react';

export default function CircuitDiffViewer() {
  const { lastResult, repo, addLog } = useGexStore();
  const [applying, setApplying] = useState(false);
  const [appliedIndices, setAppliedIndices] = useState(new Set());

  // Reset when a new file result comes in
  useEffect(() => {
    setAppliedIndices(new Set());
  }, [lastResult?.file]);

  if (!lastResult?.diff?.hunks?.length) {
    return null;
  }

  const { hunks, total_additions, total_deletions } = lastResult.diff;
  
  // Cleanly join base directory avoiding double slashes if path already has it
  const filePath = `${repo?.path}/${lastResult.file}`.replace(/[/]+/g, '/');

  const handleApply = async (hunkIndex, e) => {
    if (e) e.stopPropagation();
    if (appliedIndices.has(hunkIndex)) return;
    
    setApplying(true);
    addLog(`Applying targeted hunk to ${lastResult.file}...`, 'info');
    try {
      await applyPatches({
        file_path: filePath,
        accepted_hunks: [hunkIndex],
        hunks: hunks
      });
      setAppliedIndices(prev => new Set([...prev, hunkIndex]));
      addLog(`Hunk applied successfully to ${lastResult.file}.`, 'success', 'patch');
    } catch (err) {
      addLog(`Failed to apply hunk: ${err.message}`, 'error');
    } finally {
      setApplying(false);
    }
  };

  const handleApplyAll = async () => {
    setApplying(true);
    addLog(`Applying remaining hunks to ${lastResult.file}...`, 'info');
    try {
      const allIndices = hunks.map((_, i) => i);
      const toApply = allIndices.filter(i => !appliedIndices.has(i));
      
      if (toApply.length === 0) {
        setApplying(false);
        return;
      }

      await applyPatches({
        file_path: filePath,
        accepted_hunks: toApply,
        hunks: hunks
      });
      setAppliedIndices(new Set(allIndices));
      addLog(`Applied ${toApply.length} hunks successfully to ${lastResult.file}.`, 'success', 'patch');
    } catch (err) {
      addLog(`Failed to apply hunks: ${err.message}`, 'error');
    } finally {
      setApplying(false);
    }
  };

  const allApplied = appliedIndices.size === hunks.length && hunks.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <span className="panel-label">Diff Hunks</span>
        
        <div className="flex items-center gap-sm">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginRight: '8px' }}>
            <span style={{ color: 'var(--accent-green)' }}>+{total_additions}</span>
            {' / '}
            <span style={{ color: 'var(--accent-red)' }}>-{total_deletions}</span>
          </span>

          <button 
            className={`btn btn-sm ${allApplied ? 'btn-success' : 'btn-primary'}`}
            title="Apply all unapplied hunks in this file to workspace"
            onClick={handleApplyAll} 
            disabled={applying || allApplied}
            style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)' }}
          >
            {allApplied ? (
              <><CheckCheck size={12} /> All Applied</>
            ) : (
              <><Play size={12} /> Apply All Unsaved</>
            )}
          </button>
        </div>
      </div>

      {hunks.map((hunk, idx) => (
        <HunkCard 
          key={idx} 
          hunk={hunk} 
          index={idx} 
          isApplied={appliedIndices.has(idx)}
          onApply={(e) => handleApply(idx, e)}
          disabled={applying}
        />
      ))}
    </div>
  );
}

function HunkCard({ hunk, index, isApplied, onApply, disabled }) {
  const [expanded, setExpanded] = useState(true);

  const typeColor = {
    modification: 'var(--accent-orange)',
    addition: 'var(--accent-green)',
    deletion: 'var(--accent-red)',
  }[hunk.type] || 'var(--text-dim)';

  return (
    <div className="diff-hunk">
      <div 
        className="diff-hunk-header" 
        onClick={() => setExpanded(v => !v)} 
        style={{ cursor: 'pointer', opacity: isApplied ? 0.7 : 1 }}
      >
        <span>
          <span style={{ color: typeColor, fontWeight: 600 }}>
            {hunk.type?.toUpperCase()}
          </span>
          {' '}
          <span>L{hunk.start}–L{hunk.end}</span>
        </span>
        
        <div className="flex items-center gap-sm">
          {isApplied ? (
            <span style={{ color: 'var(--accent-green)', fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Applied
            </span>
          ) : (
            <button 
              className="btn btn-sm btn-cyan" 
              onClick={onApply} 
              disabled={disabled}
              style={{ padding: '0px 6px', fontSize: '10px', height: '18px' }}
            >
              APPLY
            </button>
          )}
          <span>{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {expanded && (
        <div className="diff-hunk-body" style={{ opacity: isApplied ? 0.6 : 1 }}>
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
