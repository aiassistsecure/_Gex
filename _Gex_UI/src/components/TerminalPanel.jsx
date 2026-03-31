import { useState, useRef, useEffect } from 'react';
import useGexStore from '../store/useGexStore';
import { TerminalSquare, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export default function TerminalPanel({ height = 220, onResizeStart }) {
  const { logs, clearLogs } = useGexStore();
  const [collapsed, setCollapsed] = useState(false);
  const logEndRef = useRef(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (!collapsed) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, collapsed]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-0)',
      height: collapsed ? '34px' : `${height}px`,
      minHeight: collapsed ? '34px' : '100px',
      transition: collapsed ? 'height 0.2s ease' : 'none',
      zIndex: 10,
      position: 'relative'
    }}>
      {/* Dynamic Resize Handle (Top) */}
      {!collapsed && onResizeStart && (
        <div 
          style={{
            position: 'absolute',
            top: '-2px', left: 0, right: 0, height: '4px',
            cursor: 'row-resize',
            zIndex: 20
          }}
          onMouseDown={onResizeStart}
        />
      )}
      {/* Header */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: '34px',
          minHeight: '34px',
          background: 'var(--surface-0)',
          borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalSquare size={14} color="var(--text-muted)" />
          <span className="panel-label" style={{ 
            fontSize: 'var(--font-size-xs)', 
            color: collapsed ? 'var(--text-dim)' : 'var(--text-primary)' 
          }}>
            Terminal Output
          </span>
          <span style={{
            fontSize: '10px',
            color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {logs.length}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!collapsed && (
            <button 
              className="btn btn-icon btn-sm" 
              onClick={(e) => { e.stopPropagation(); clearLogs(); }}
              title="Clear output"
            >
              <Trash2 size={13} color="var(--text-dim)" />
            </button>
          )}
          <button className="btn btn-icon btn-sm">
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div 
          className="log-output" 
          style={{ 
            margin: 0, 
            borderRadius: 0, 
            border: 'none',
            background: 'var(--void)',
            flex: 1,
            padding: '12px 16px',
            fontFamily: 'var(--font-mono)'
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Terminal is idle. Process logs will appear here.
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={`log-line ${log.level}`} style={{ padding: '2px 0' }}>
                <span className="log-time" style={{ opacity: 0.6 }}>
                  {new Date(log.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })}
                </span>
                <span className="log-msg" style={{ marginLeft: '12px' }}>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
