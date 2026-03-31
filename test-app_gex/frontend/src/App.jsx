import { useState, useEffect, useRef } from 'react';

const API_URL = '/api';
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.hostname}:18765/ws`;

export default function App() {
  const [status, setStatus] = useState('connecting');
  const [appInfo, setAppInfo] = useState(null);
  const [wsMessages, setWsMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/info`)
      .then((r) => {
        if (!r.ok) {
          throw new Error('Failed to fetch app info');
        }
        return r.json();
      })
      .then((data) => {
        setAppInfo(data);
      })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setWsMessages((prev) => [
        ...prev,
        { type: 'system', text: 'WebSocket connected' },
      ]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setWsMessages((prev) => [
          ...prev,
          { type: 'incoming', text: JSON.stringify(data, null, 2) },
        ]);
      } catch {
        setWsMessages((prev) => [
          ...prev,
          { type: 'incoming', text: event.data },
        ]);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setWsMessages((prev) => [
        ...prev,
        { type: 'system', text: 'WebSocket error' },
      ]);
    };

    ws.onclose = () => {
      setStatus('disconnected');
      setWsMessages((prev) => [
        ...prev,
        { type: 'system', text: 'WebSocket disconnected' },
      ]);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const msg = { type: 'user:message', payload: { text: input.trim() } };
    wsRef.current.send(JSON.stringify(msg));
    setWsMessages((prev) => [
      ...prev,
      { type: 'outgoing', text: JSON.stringify(msg, null, 2) },
    ]);
    setInput('');
  };

  const statusColor = {
    connected: 'bg-emerald-500',
    connecting: 'bg-amber-500 animate-pulse',
    disconnected: 'bg-zinc-500',
    error: 'bg-red-500',
  }[status] || 'bg-zinc-500';

  const navItems = ['Dashboard', 'Projects', 'Agents', 'Settings'];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="glass border-b border-white/5 px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
            aria-label="Open navigation"
          >
            ☰
          </button>

          <div>
            <h1 className="text-lg font-semibold">AI Assist</h1>
            <p className="text-sm text-zinc-400">
              {appInfo?.name || 'Realtime dashboard'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span className="capitalize">{status}</span>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`${mobileNavOpen ? 'block' : 'hidden'} md:block w-full md:w-64 border-r border-white/5 bg-white/[0.02]`}
        >
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item}
                type="button"
                className="w-full text-left px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => setMobileNavOpen(false)}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6">
          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-2">App Info</h2>
            <pre className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300 overflow-auto">
              {JSON.stringify(appInfo || { message: 'Loading...' }, null, 2)}
            </pre>
          </section>

          <section className="mb-6">
            <h2 className="text-xl font-semibold mb-2">WebSocket Messages</h2>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 h-80 overflow-auto space-y-3">
              {wsMessages.length === 0 ? (
                <p className="text-zinc-500">No messages yet.</p>
              ) : (
                wsMessages.map((message, index) => (
                  <div key={index} className="border-b border-white/5 pb-3 last:border-b-0">
                    <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                      {message.type}
                    </div>
                    <pre className="text-sm text-zinc-200 whitespace-pre-wrap break-words">
                      {message.text}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">Send Message</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-zinc-500 outline-none focus:border-white/20"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim() || status !== 'connected'}
                className="rounded-lg px-4 py-2 bg-white text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}