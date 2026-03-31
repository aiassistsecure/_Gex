import { useState, useEffect, useRef } from 'react';

const API_URL = '/api';
const WS_URL = `ws://${window.location.hostname}:18765/ws`;

export default function App() {
  const [status, setStatus] = useState('connecting');
  const [appInfo, setAppInfo] = useState(null);
  const [wsMessages, setWsMessages] = useState([]);
  const [input, setInput] = useState('');
  const wsRef = useRef(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
        setWsMessages(prev => [...prev, { type: 'system', text: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ï¿½Ã¢â‚¬â€� WebSocket connected' }]);

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
        setWsMessages(prev => [...prev, { type: 'system', text: 'ÃƒÂ°Ã…Â¸Ã¢â‚¬ï¿½Ã…â€™ WebSocket disconnected' }]);
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

  const navItems = ['Dashboard', 'Projects', 'Agents', 'Settings'];

      <header className="glass border-b border-white/5 px-4 sm:px-6 py-4 flex items-center justify-between gap-4"
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' }}
            aria-label="Open navigation"
          >
            Ã¢ËœÂ°
          </button>