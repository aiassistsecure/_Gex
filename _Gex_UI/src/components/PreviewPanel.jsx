/**
 * PreviewPanel — Live preview iframe with graceful fallback
 * Shows a placeholder when no app is running on the target port
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export default function PreviewPanel({ url = 'http://localhost:3000' }) {
  const iframeRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(url);
  const [status, setStatus] = useState('checking'); // checking | connected | disconnected

  // Probe the preview URL to check if something is running
  const checkConnection = useCallback(async () => {
    try {
      setStatus('checking');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      await fetch(previewUrl, { mode: 'no-cors', signal: ctrl.signal });
      clearTimeout(timer);
      setStatus('connected');
    } catch {
      setStatus('disconnected');
    }
  }, [previewUrl]);

  useEffect(() => {
    checkConnection();
    // Re-check every 5s when disconnected
    const interval = setInterval(() => {
      if (status === 'disconnected') checkConnection();
    }, 5000);
    return () => clearInterval(interval);
  }, [previewUrl, status, checkConnection]);

  const handleRefresh = useCallback(() => {
    checkConnection();
    if (iframeRef.current && status === 'connected') {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl, status, checkConnection]);

  return (
    <>
      <div className="preview-header">
        <div className="preview-header-title">
          <div className="live-dot" style={{
            background: status === 'connected' ? 'var(--accent-green)' :
                        status === 'checking' ? 'var(--accent-yellow)' : 'var(--text-dim)',
            animation: status === 'connected' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }} />
          <span>PREVIEW</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            className="input input-sm"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRefresh(); }}
            style={{ width: '160px', fontSize: 'var(--font-size-xs)' }}
          />
          <button className="btn btn-sm btn-icon" onClick={handleRefresh} title="Refresh">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button
            className="btn btn-sm btn-icon"
            onClick={() => window.open(previewUrl, '_blank')}
            title="Open in browser"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
        </div>
      </div>

      {status === 'connected' ? (
        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="preview-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Live Preview"
        />
      ) : (
        <div className="empty-state" style={{ background: 'var(--surface-1)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
               style={{ color: 'var(--text-dim)', marginBottom: '4px' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <h3>No App Running</h3>
          <p style={{ maxWidth: '220px' }}>
            {status === 'checking' ? (
              'Connecting...'
            ) : (
              <>
                Start your app to see it here.
                <br />
                <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-size-xs)' }}>
                  Watching {previewUrl}
                </span>
              </>
            )}
          </p>
          <button className="btn btn-sm" onClick={handleRefresh} style={{ marginTop: '8px' }}>
            Retry Connection
          </button>
        </div>
      )}
    </>
  );
}
