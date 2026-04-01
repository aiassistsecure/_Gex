/**
 * JennyBuildModal — Full-screen lock screen during jenny build / jenny package
 * Shows animated Jenny avatar, stage progress, and live log stream.
 */
import { useEffect, useRef, useState } from 'react';

const STAGES = {
  build: [
    { id: 'python', label: 'PyInstaller → Backend', icon: '🐍' },
    { id: 'frontend', label: 'Vite → Frontend',     icon: '⚡' },
    { id: 'done',    label: 'Build Complete',        icon: '✅' },
  ],
  package: [
    { id: 'check',   label: 'Build Artifacts Check', icon: '🔍' },
    { id: 'pack',    label: 'Electron Builder',       icon: '📦' },
    { id: 'output',  label: 'Generating Outputs',     icon: '💿' },
    { id: 'done',    label: 'Package Ready',          icon: '🚀' },
  ],
};

// Guess current stage from log line content
function detectStage(action, line) {
  const l = line.toLowerCase();
  if (action === 'build') {
    if (l.includes('pyinstaller') || l.includes('python') || l.includes('pip')) return 0;
    if (l.includes('vite') || l.includes('frontend') || l.includes('react'))   return 1;
    if (l.includes('complete') || l.includes('built'))                          return 2;
  } else if (action === 'package') {
    if (l.includes('check') || l.includes('not built') || l.includes('build first')) return 0;
    if (l.includes('electron-builder') || l.includes('packaging'))                   return 1;
    if (l.includes('artifact') || l.includes('.exe') || l.includes('.dmg'))          return 2;
    if (l.includes('packaged') || l.includes('distribute') || l.includes('ready'))   return 3;
  }
  return null;
}

export default function JennyBuildModal({ action, logs = [], status }) {
  const stages = STAGES[action] || STAGES.build;
  const [stageIdx, setStageIdx] = useState(0);
  const [frame, setFrame]       = useState(0);
  const logRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Advance stage from log content
  useEffect(() => {
    const last = logs[logs.length - 1];
    if (last) {
      const detected = detectStage(action, last);
      if (detected !== null && detected > stageIdx) setStageIdx(detected);
    }
  }, [logs, action, stageIdx]);

  // Snap to final stage on complete
  useEffect(() => {
    if (status === 'complete' || status === 'error') {
      setStageIdx(status === 'complete' ? stages.length - 1 : stageIdx);
    }
  }, [status]);

  // Cycle Jenny avatar frames while running
  useEffect(() => {
    if (status === 'running') {
      const t = setInterval(() => setFrame(f => (f + 1) % 2), 1400);
      return () => clearInterval(t);
    }
  }, [status]);

  const avatarSrc = status === 'complete' ? '/jenny-done.png'
    : status === 'error'                  ? '/jenny-idle.png'
    : frame === 0                         ? '/jenny-working.png'
    :                                       '/jenny-idle.png';

  const isError    = status === 'error';
  const isComplete = status === 'complete';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(9,9,9,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif",
      animation: 'fade-in 0.25s ease',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '520px', height: '260px', borderRadius: '50%',
        background: isError
          ? 'radial-gradient(ellipse, rgba(230,57,70,0.12) 0%, transparent 70%)'
          : isComplete
            ? 'radial-gradient(ellipse, rgba(111,190,68,0.12) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(232,93,4,0.10) 0%, transparent 70%)',
        pointerEvents: 'none', transition: 'background 0.6s ease',
      }} />

      <div style={{
        width: '480px', background: '#111113',
        border: `1px solid ${isError ? 'rgba(230,57,70,0.3)' : isComplete ? 'rgba(111,190,68,0.3)' : 'rgba(232,93,4,0.2)'}`,
        borderRadius: '16px', padding: '32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
        boxShadow: isError
          ? '0 0 60px rgba(230,57,70,0.15)'
          : isComplete
            ? '0 0 60px rgba(111,190,68,0.15)'
            : '0 0 60px rgba(232,93,4,0.12)',
        position: 'relative', zIndex: 1,
        animation: isComplete ? 'jenny-bounce 0.5s ease' : 'none',
      }}>

        {/* Jenny Avatar */}
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', inset: '-5px', borderRadius: '50%',
            background: isError    ? 'conic-gradient(from 0deg, #e63946, #ff6b6b, #e63946)'
              : isComplete ? 'conic-gradient(from 0deg, #6fbe44, #fca311, #6fbe44)'
              : 'conic-gradient(from 0deg, #e85d04, #f48c06, #dc2f02, #e85d04)',
            animation: isComplete || isError ? 'jenny-spin 4s linear infinite' : 'jenny-spin 1.8s linear infinite',
            opacity: isComplete ? 0.9 : isError ? 0.8 : 1,
          }} />
          <img
            src={avatarSrc}
            alt="Jenny"
            style={{
              width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover',
              position: 'relative', zIndex: 1,
              border: '3px solid #111113',
              boxShadow: isError
                ? '0 0 20px 6px rgba(230,57,70,0.6)'
                : isComplete
                  ? '0 0 20px 6px rgba(111,190,68,0.6)'
                  : '0 0 20px 6px rgba(232,93,4,0.55)',
              animation: !isComplete && !isError ? 'jenny-pulse 1.4s ease-in-out infinite' : isComplete ? 'jenny-bounce 0.5s ease' : 'none',
              transition: 'box-shadow 0.4s ease',
            }}
          />
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(232,93,4,0.7)', marginBottom: '6px' }}>
            Jenny {action === 'package' ? 'Package' : 'Build'}
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f0ece8' }}>
            {isError    ? '❌ Something went wrong'
             : isComplete ? '🎉 Done!'
             : stages[stageIdx]?.label ?? 'Working...'}
          </h2>
          {!isComplete && !isError && (
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
              Don't close — Jenny is surgically assembling your app
            </p>
          )}
        </div>

        {/* Stage tracker */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {stages.map((s, i) => {
            const done    = isComplete ? true : i < stageIdx;
            const active  = !isComplete && i === stageIdx;
            const pending = !done && !active;
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: '8px',
                background: active  ? 'rgba(232,93,4,0.10)'
                  : done   ? 'rgba(111,190,68,0.07)'
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${active ? 'rgba(232,93,4,0.25)' : done ? 'rgba(111,190,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                transition: 'all 0.3s ease',
              }}>
                <span style={{ fontSize: '14px', opacity: pending ? 0.35 : 1 }}>{s.icon}</span>
                <span style={{
                  flex: 1, fontSize: '12px', fontWeight: active ? 600 : 400,
                  color: done ? '#6fbe44' : active ? '#f0ece8' : 'rgba(255,255,255,0.3)',
                }}>{s.label}</span>
                {done   && <span style={{ color: '#6fbe44', fontSize: '12px' }}>✓</span>}
                {active && !isComplete && <span style={{ display: 'flex', gap: '3px' }}>{[0,1,2].map(d => (
                  <span key={d} style={{
                    width: '4px', height: '4px', borderRadius: '50%', background: '#e85d04',
                    animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite`,
                    display: 'inline-block',
                  }}/>
                ))}</span>}
              </div>
            );
          })}
        </div>

        {/* Live log tail */}
        <div ref={logRef} style={{
          width: '100%', height: '100px', overflowY: 'auto',
          background: '#090909', borderRadius: '8px', padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.06)',
          fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', lineHeight: 1.7,
        }}>
          {logs.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.2)' }}>Waiting for output...</div>
          )}
          {logs.map((line, i) => (
            <div key={i} style={{
              color: line.includes('error') || line.includes('fail') ? '#e63946'
                : line.includes('complete') || line.includes('✅') ? '#6fbe44'
                : 'rgba(255,255,255,0.45)',
            }}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
