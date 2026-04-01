import { useState, useEffect, useRef } from 'react';

const API_URL = '/api';
const WS_URL = `ws://${window.location.hostname}:18765/ws`;

export default function App() {
  const [status, setStatus] = useState('connecting');
  const [appInfo, setAppInfo] = useState(null);
  const [wsMessages, setWsMessages] = useState([]);
  const [input, setInput] = useState('');
  const wsRef = useRef(null);

  // Fetch app info
  useEffect(() => {
    fetch(`${API_URL}/info`)
      .then(r => r.json())
      .then(data => {
        setAppInfo(data);
        setStatus('connected');
      })
      .catch(() => setStatus('error'));
  }, []);

  // WebSocket connection
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setWsMessages(prev => [...prev, { type: 'system', text: '🔗 WebSocket connected' }]);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setWsMessages(prev => [...prev, { type: 'incoming', text: JSON.stringify(data, null, 2) }]);
        } catch {
          setWsMessages(prev => [...prev, { type: 'incoming', text: event.data }]);
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        setWsMessages(prev => [...prev, { type: 'system', text: '🔌 WebSocket disconnected' }]);
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        setStatus('error');
      };
    };

    connect();
    return () => wsRef.current?.close();
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current) return;
    const msg = { type: 'user:message', payload: { text: input } };
    wsRef.current.send(JSON.stringify(msg));
    setWsMessages(prev => [...prev, { type: 'outgoing', text: JSON.stringify(msg, null, 2) }]);
    setInput('');
  };

  const statusColor = {
    connected: 'bg-emerald-500',
    connecting: 'bg-amber-500 animate-pulse',
    disconnected: 'bg-zinc-500',
    error: 'bg-red-500',
  }[status];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between"
              style={{ WebkitAppRegion: 'drag' }}>
        <div className="flex items-center gap-3">
          <div className="text-2xl">🧬</div>
          <div>
            <h1 className="text-lg font-semibold text-white">
              {appInfo?.name || '{{ project_name }}'}
            </h1>
            <p className="text-xs text-zinc-500">Built with Jenny</p>
          </div>
        </div>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-zinc-400 capitalize">{status}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 glass border-r border-white/5 p-4 flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Navigation</h2>
          {['Dashboard', 'Projects', 'Agents', 'Settings'].map((item) => (
            <button
              key={item}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              {item}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <div className="flex-1 p-6 flex flex-col gap-6">
          {/* Status Cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Runtime', value: 'Python 3.10+', icon: '🐍' },
              { label: 'Framework', value: appInfo?.framework || 'Jenny', icon: '🧬' },
              { label: 'WebSocket', value: status, icon: '⚡' },
            ].map((card) => (
              <div key={card.label} className="glass rounded-xl p-4 glow">
                <div className="flex items-center gap-2 mb-1">
                  <span>{card.icon}</span>
                  <span className="text-xs text-zinc-500">{card.label}</span>
                </div>
                <p className="text-lg font-semibold text-white">{card.value}</p>
              </div>
            ))}
          </div>

          {/* WebSocket Console */}
          <div className="flex-1 glass rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-300">Live Console</span>
              <span className="text-xs text-zinc-600 font-mono">{WS_URL}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 max-h-[400px]">
              {wsMessages.map((msg, i) => (
                <pre
                  key={i}
                  className={`whitespace-pre-wrap ${
                    msg.type === 'system' ? 'text-zinc-500' :
                    msg.type === 'outgoing' ? 'text-jenny-400' :
                    'text-emerald-400'
                  }`}
                >
                  {msg.type === 'outgoing' ? '→ ' : msg.type === 'incoming' ? '← ' : '• '}
                  {msg.text}
                </pre>
              ))}
              {wsMessages.length === 0 && (
                <p className="text-zinc-600 italic">Waiting for messages...</p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-white/5 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Send a WebSocket message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-jenny-500/50 transition-colors"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-jenny-600 hover:bg-jenny-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
