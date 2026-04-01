/**
 * JennyBuildModal — Full-screen lock screen during jenny build / jenny package
 * Animates stage progress on a timer so it never looks stuck.
 */
import { useEffect, useRef, useState } from 'react';

const SCHEDULE = {
  build:   [0, 35, 75],
  package: [0, 8, 30, 55],
};

const HINTS = {
  build: [
    ['Checking PyInstaller...', 'Cleaning old dist...', 'Compiling Python modules...', 'Bundling dependencies...', 'Tracing imports...', 'Optimising bytecode...'],
    ['Installing node deps...', 'Transpiling React...', 'Tree-shaking bundles...', 'Generating assets...', 'Minifying output...'],
    ['Verifying artifacts...', 'All systems go 🚀'],
  ],
  package: [
    ['Verifying build artifacts...', 'Checking dist/jenny/...'],
    ['Invoking electron-builder...', 'Packing ASAR...', 'Copying resources...', 'Writing installer...'],
    ['Generating NSIS installer...', 'Building portable exe...', 'Signing outputs...'],
    ['Finalising distribution...', 'Almost there...'],
  ],
};

const STAGES = {
  build: [
    { id: 'python',   label: 'PyInstaller → Backend', icon: '🐍' },
    { id: 'frontend', label: 'Vite → Frontend',        icon: '⚡' },
    { id: 'done',     label: 'Build Complete',          icon: '✅' },
  ],
  package: [
    { id: 'check',  label: 'Artifact Check',     icon: '🔍' },
    { id: 'pack',   label: 'Electron Builder',   icon: '📦' },
    { id: 'output', label: 'Generating Outputs', icon: '💿' },
    { id: 'done',   label: 'Package Ready',      icon: '🚀' },
  ],
};

function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function JennyBuildModal({ action, logs = [], status }) {
  const stages   = STAGES[action]   || STAGES.build;
  const schedule = SCHEDULE[action] || SCHEDULE.build;
  const hints    = HINTS[action]    || HINTS.build;

  const [stageIdx, setStageIdx] = useState(0);
  const [hintIdx,  setHintIdx]  = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [frame,    setFrame]    = useState(0);
  const logRef   = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (status !== 'running') return;
    startRef.current = Date.now();
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(secs);
      const next = schedule.filter(s => secs >= s).length - 1;
      setStageIdx(prev => Math.min(Math.max(prev, next), stages.length - 2));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setHintIdx(h => h + 1), 3000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setFrame(f => (f + 1) % 2), 1400);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status === 'complete') setStageIdx(stages.length - 1);
  }, [status]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const isError    = status === 'error';
  const isComplete = status === 'complete';
  const isRunning  = status === 'running';

  const avatarSrc = isComplete ? '/jenny-done.png'
    : isError     ? '/jenny-idle.png'
    : frame === 0 ? '/jenny-working.png'
    :               '/jenny-idle.png';

  const currentHints = hints[stageIdx] || [];
  const currentHint  = currentHints[hintIdx % currentHints.length] || '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(9,9,9,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
      animation: 'fade-in 0.25s ease',
    }}>
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '520px', height: '260px', borderRadius: '50%',
        background: isError    ? 'radial-gradient(ellipse, rgba(230,57,70,0.12) 0%, transparent 70%)'
          : isComplete ? 'radial-gradient(ellipse, rgba(111,190,68,0.12) 0%, transparent 70%)'
          : 'radial-gradient(ellipse, rgba(232,93,4,0.10) 0%, transparent 70%)',
        pointerEvents: 'none', transition: 'background 0.6s ease',
      }} />

      <div style={{
        width: '480px', background: '#111113',
        border: `1px solid ${isError ? 'rgba(230,57,70,0.3)' : isComplete ? 'rgba(111,190,68,0.3)' : 'rgba(232,93,4,0.2)'}`,
        borderRadius: '16px', padding: '32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
        boxShadow: isError ? '0 0 60px rgba(230,57,70,0.15)'
          : isComplete ? '0 0 60px rgba(111,190,68,0.15)'
          : '0 0 60px rgba(232,93,4,0.12)',
        position: 'relative', zIndex: 1,
      }}>

        {/* Avatar + elapsed */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: '-5px', borderRadius: '50%',
              background: isError    ? 'conic-gradient(from 0deg, #e63946, #ff6b6b, #e63946)'
                : isComplete ? 'conic-gradient(from 0deg, #6fbe44, #fca311, #6fbe44)'
                : 'conic-gradient(from 0deg, #e85d04, #f48c06, #dc2f02, #e85d04)',
              animation: `jenny-spin ${isRunning ? '1.4s' : '4s'} linear infinite`,
            }} />
            <img src={avatarSrc} alt="Jenny" style={{
              width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover',
              position: 'relative', zIndex: 1, border: '3px solid #111113',
              boxShadow: isError ? '0 0 20px 6px rgba(230,57,70,0.6)'
                : isComplete ? '0 0 20px 6px rgba(111,190,68,0.6)'
                : '0 0 20px 6px rgba(232,93,4,0.55)',
              animation: isRunning ? 'jenny-pulse 1.4s ease-in-out infinite' : 'none',
            }} />
          </div>
          {isRunning && (
            <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: 'rgba(232,93,4,0.6)', letterSpacing: '1px' }}>
              ⏱ {fmt(elapsed)}
            </div>
          )}
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(232,93,4,0.7)', marginBottom: '6px' }}>
            Jenny {action === 'package' ? 'Package' : 'Build'}
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#f0ece8' }}>
            {isError ? '❌ Something went wrong' : isComplete ? '🎉 Done!' : stages[stageIdx]?.label ?? 'Working...'}
          </h2>
          {isRunning && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.35)', minHeight: '16px' }}>
              {currentHint}
            </p>
          )}
        </div>

        {/* Stage tracker */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {stages.map((s, i) => {
            const done   = isComplete || i < stageIdx;
            const active = !isComplete && i === stageIdx;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 12px', borderRadius: '8px',
                background: active ? 'rgba(232,93,4,0.10)' : done ? 'rgba(111,190,68,0.07)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${active ? 'rgba(232,93,4,0.25)' : done ? 'rgba(111,190,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                transition: 'all 0.5s ease',
              }}>
                <span style={{ fontSize: '13px', opacity: (!done && !active) ? 0.3 : 1, transition: 'opacity 0.3s' }}>{s.icon}</span>
                <span style={{
                  flex: 1, fontSize: '12px', fontWeight: active ? 600 : 400,
                  color: done ? '#6fbe44' : active ? '#f0ece8' : 'rgba(255,255,255,0.25)',
                  transition: 'color 0.4s ease',
                }}>{s.label}</span>
                {done && <span style={{ color: '#6fbe44', fontSize: '11px' }}>✓</span>}
                {active && isRunning && (
                  <span style={{ display: 'flex', gap: '3px' }}>
                    {[0, 1, 2].map(d => (
                      <span key={d} style={{
                        width: '4px', height: '4px', borderRadius: '50%', background: '#e85d04',
                        animation: `pulse-dot 1.1s ease-in-out ${d * 0.18}s infinite`,
                        display: 'inline-block',
                      }} />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Crawling progress bar */}
        {isRunning && (
          <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #dc2f02, #e85d04, #f48c06)',
              borderRadius: '2px',
              animation: 'progress-crawl 2.2s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Log tail */}
        <div ref={logRef} style={{
          width: '100%', height: '80px', overflowY: 'auto',
          background: '#090909', borderRadius: '8px', padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.05)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', lineHeight: 1.7,
        }}>
          {logs.length === 0
            ? <div style={{ color: 'rgba(255,255,255,0.18)' }}>Jenny is working hard for you...</div>
            : logs.map((line, i) => (
              <div key={i} style={{
                color: /error|fail/i.test(line) ? '#e63946'
                  : /complete|✅|done/i.test(line) ? '#6fbe44'
                  : 'rgba(255,255,255,0.4)',
              }}>{line}</div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
