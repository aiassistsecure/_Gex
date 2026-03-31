/**
 * DiffViewer — Hunk-based diff display with PCB trace aesthetics
 */
import useGexStore from '../store/useGexStore';

export default function DiffViewer() {
  const { lastResult } = useGexStore();

  if (!lastResult || !lastResult.diff || lastResult.diff.hunks.length === 0) {
    return null;
  }

  const { diff } = lastResult;

  return (
    <div className="diff-panel fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span className="panel-title" style={{ fontSize: '0.7rem' }}>STRUCTURED DIFF</span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
        }}>
          +{diff.total_additions} −{diff.total_deletions} in {diff.hunks.length} hunk{diff.hunks.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="diff-hunks">
        {diff.hunks.map((hunk, i) => (
          <div className="diff-hunk" key={i}>
            <div className="diff-hunk-header">
              <span className="diff-hunk-location">
                Lines {hunk.start}–{hunk.end}
              </span>
              <span className={`diff-hunk-type ${hunk.type}`}>
                {hunk.type}
              </span>
            </div>

            {/* Removed lines */}
            {hunk.before_lines.map((line, j) => (
              <div className="diff-line removed" key={`r-${i}-${j}`}>
                <span className="diff-line-num">{hunk.start + j}</span>
                <span className="diff-line-content">{line || ' '}</span>
              </div>
            ))}

            {/* Added lines */}
            {hunk.after_lines.map((line, j) => (
              <div className="diff-line added" key={`a-${i}-${j}`}>
                <span className="diff-line-num">+</span>
                <span className="diff-line-content">{line || ' '}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
