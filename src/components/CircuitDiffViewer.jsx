/**
 * CircuitDiffViewer — Motherboard Chipset Aesthetic Diff Engine
 * 
 * Each hunk is rendered as a "chip" on a PCB substrate, connected
 * by copper trace lines. Solder points glow on changed lines.
 * Per-hunk accept/reject controls for surgical precision.
 */
import { useState, useRef, useEffect } from 'react';
import useGexStore from '../store/useGexStore';
import { applyPatches } from '../services/api';

function HunkChip({ hunk, index, onAccept, onReject, status }) {
  const chipRef = useRef(null);

  const statusClass = status === 'accepted' ? 'accepted' : status === 'rejected' ? 'rejected' : 'pending';
  const typeClass = hunk.type || 'modification';

  return (
    <div
      ref={chipRef}
      className={`pcb-hunk-chip ${statusClass}`}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      {/* Chip pinout header */}
      <div className="chip-pinout-header">
        <div className="chip-pin-group left">
          <span className="chip-pin" />
          <span className="chip-pin" />
          <span className="chip-pin active" />
        </div>

        <div className="chip-label-zone">
          <span className="chip-label-id">HUNK_{String(index).padStart(2, '0')}</span>
          <span className={`chip-type-badge ${typeClass}`}>
            {typeClass === 'addition' ? '+ ADD' : typeClass === 'deletion' ? '− DEL' : '~ MOD'}
          </span>
        </div>

        <div className="chip-pin-group right">
          <span className="chip-pin active" />
          <span className="chip-pin" />
          <span className="chip-pin" />
        </div>
      </div>

      {/* Line range & stats */}
      <div className="chip-meta-bar">
        <span className="chip-location">
          <span className="loc-icon">◈</span>
          L{hunk.start}–{hunk.end}
        </span>
        <span className="chip-stats">
          {hunk.after_lines?.length > 0 && (
            <span className="stat-add">+{hunk.after_lines.length}</span>
          )}
          {hunk.before_lines?.length > 0 && (
            <span className="stat-del">−{hunk.before_lines.length}</span>
          )}
        </span>
      </div>

      {/* Trace border gutter */}
      <div className="chip-trace-gutter" />

      {/* Code content */}
      <div className="chip-code-block">
        {/* Removed lines */}
        {hunk.before_lines?.map((line, j) => (
          <div className="pcb-diff-line removed" key={`r-${j}`}>
            <span className="solder-point del" />
            <span className="line-num">{hunk.start + j}</span>
            <span className="line-code">{line || '\u00A0'}</span>
          </div>
        ))}

        {/* Separator trace between removed and added */}
        {hunk.before_lines?.length > 0 && hunk.after_lines?.length > 0 && (
          <div className="pcb-trace-separator">
            <div className="trace-line" />
            <span className="trace-node" />
            <div className="trace-line" />
          </div>
        )}

        {/* Added lines */}
        {hunk.after_lines?.map((line, j) => (
          <div className="pcb-diff-line added" key={`a-${j}`}>
            <span className="solder-point add" />
            <span className="line-num">+</span>
            <span className="line-code">{line || '\u00A0'}</span>
          </div>
        ))}
      </div>

      {/* Per-hunk controls */}
      <div className="chip-controls">
        <button
          className={`chip-ctrl-btn accept ${status === 'accepted' ? 'active' : ''}`}
          onClick={() => onAccept(index)}
          title="Accept this patch"
        >
          <span className="ctrl-icon">✓</span>
          <span className="ctrl-label">Accept</span>
        </button>
        <button
          className={`chip-ctrl-btn reject ${status === 'rejected' ? 'active' : ''}`}
          onClick={() => onReject(index)}
          title="Reject this patch"
        >
          <span className="ctrl-icon">✕</span>
          <span className="ctrl-label">Reject</span>
        </button>
      </div>

      {/* Status indicator LED */}
      <div className={`chip-status-led ${statusClass}`} />
    </div>
  );
}

function TraceConnector() {
  return (
    <div className="pcb-trace-connector">
      <svg width="100%" height="28" viewBox="0 0 200 28" preserveAspectRatio="none">
        <path
          d="M 100 0 L 100 8 Q 100 14 106 14 L 140 14 Q 146 14 146 20 L 146 28"
          fill="none"
          stroke="url(#copper-gradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 100 0 L 100 8 Q 100 14 94 14 L 60 14 Q 54 14 54 20 L 54 28"
          fill="none"
          stroke="url(#copper-gradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
        />
        {/* Solder nodes */}
        <circle cx="100" cy="0" r="2.5" fill="#d4a574" opacity="0.8">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="146" cy="28" r="2.5" fill="#d4a574" opacity="0.6" />
        <circle cx="54" cy="28" r="2" fill="#7f8cff" opacity="0.3" />
        <defs>
          <linearGradient id="copper-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d4a574" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#e8c878" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#d4a574" stopOpacity="0.4" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function CircuitDiffViewer() {
  const { lastResult, activeFile, addLog, setActiveFile, setEditorMode, setLastResult } = useGexStore();
  const [hunkStatuses, setHunkStatuses] = useState({});
  const [applying, setApplying] = useState(false);
  const scrollRef = useRef(null);

  // Reset statuses when new result arrives
  useEffect(() => {
    if (lastResult?.diff?.hunks) {
      const initial = {};
      lastResult.diff.hunks.forEach((_, i) => { initial[i] = 'pending'; });
      setHunkStatuses(initial);
    }
  }, [lastResult]);

  if (!lastResult || !lastResult.diff || lastResult.diff.hunks.length === 0) {
    return (
      <div className="pcb-diff-empty">
        <div className="empty-chip">
          <div className="empty-chip-pins">
            {[...Array(6)].map((_, i) => (
              <span key={i} className="chip-pin dim" />
            ))}
          </div>
          <div className="empty-chip-body">
            <span className="empty-icon">◈</span>
            <span className="empty-text">No Diffs</span>
            <span className="empty-sub">Run a scan to see surgical patches</span>
          </div>
        </div>
      </div>
    );
  }

  const { diff } = lastResult;

  const handleAccept = (index) => {
    setHunkStatuses(prev => ({
      ...prev,
      [index]: prev[index] === 'accepted' ? 'pending' : 'accepted',
    }));
  };

  const handleReject = (index) => {
    setHunkStatuses(prev => ({
      ...prev,
      [index]: prev[index] === 'rejected' ? 'pending' : 'rejected',
    }));
  };

  const acceptedCount = Object.values(hunkStatuses).filter(s => s === 'accepted').length;
  const rejectedCount = Object.values(hunkStatuses).filter(s => s === 'rejected').length;
  const pendingCount = Object.values(hunkStatuses).filter(s => s === 'pending').length;

  const handleAcceptAll = () => {
    const newStatuses = {};
    diff.hunks.forEach((_, i) => { newStatuses[i] = 'accepted'; });
    setHunkStatuses(newStatuses);
  };

  const handleApplyAccepted = async () => {
    if (acceptedCount === 0 || !activeFile) return;

    setApplying(true);
    const acceptedIndices = Object.entries(hunkStatuses)
      .filter(([_, status]) => status === 'accepted')
      .map(([idx]) => parseInt(idx));

    try {
      const result = await applyPatches(activeFile, acceptedIndices, diff.hunks);
      
      // Update global active file state with patched content
      if (result.new_content) {
        setActiveFile(activeFile, result.new_content);
      }
      
      // Clear out the diffs so they cannot be double-applied
      setLastResult({ ...lastResult, status: 'applied_and_cleared', diff: { hunks: [], total_additions: 0, total_deletions: 0 } });
      
      addLog(`[+] Applied ${result.hunks_applied} patch(es) to ${activeFile.split(/[\\/]/).pop()}`, 'success');
      
      // Optionally switch back to editor so they can see the changes instantly
      setEditorMode('edit');
      
    } catch (err) {
      addLog(`[x] Apply failed: ${err.message}`, 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="pcb-diff-viewer">
      {/* Header bar */}
      <div className="pcb-diff-header">
        <div className="pcb-diff-title-group">
          <span className="pcb-diff-title">SURGICAL DIFF</span>
          <span className="pcb-diff-summary">
            <span className="stat-add">+{diff.total_additions}</span>
            <span className="stat-del">−{diff.total_deletions}</span>
            <span className="stat-hunks">{diff.hunks.length} hunk{diff.hunks.length !== 1 ? 's' : ''}</span>
          </span>
        </div>

        <div className="pcb-diff-controls-bar">
          <span className="hunk-counter accepted">{acceptedCount} ✓</span>
          <span className="hunk-counter rejected">{rejectedCount} ✕</span>
          <span className="hunk-counter pending">{pendingCount} ◌</span>
          <button className="btn btn-sm btn-copper" onClick={handleAcceptAll}>
            Accept All
          </button>
          {acceptedCount > 0 && (
            <button
              className="btn btn-sm btn-primary"
              onClick={handleApplyAccepted}
              disabled={applying}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              {applying ? 'APPLYING...' : `APPLY ${acceptedCount}`}
            </button>
          )}
        </div>
      </div>

      {/* Scrollable diff substrate */}
      <div className="pcb-diff-substrate" ref={scrollRef}>
        {diff.hunks.map((hunk, i) => (
          <div key={i}>
            <HunkChip
              hunk={hunk}
              index={i}
              status={hunkStatuses[i] || 'pending'}
              onAccept={handleAccept}
              onReject={handleReject}
            />
            {i < diff.hunks.length - 1 && <TraceConnector />}
          </div>
        ))}
      </div>
    </div>
  );
}
