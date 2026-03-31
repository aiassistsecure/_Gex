import { useState, useEffect, useRef } from 'react';

const API_URL = '/api';
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.hostname}:18765/ws`;



export default function App() {
  const [status, setStatus] = useState('connecting');
  const [appInfo, setAppInfo] = useState(null);
  const [wsMessages, setWsMessages] = useState([]);
  const [input, setInput] = useState('');
  const wsRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
    fetch(API_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load app info');
  useEffect(() => {
    let cancelled = false;
      })
      .then((data) => {
        if (!cancelled) {
          setAppInfo(data);
        }

    fetch(API_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load app info');
  useEffect(() => {
    let cancelled = false;
      })
      .then((data) => {
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      setWsMessages((prev) => [...prev, event.data]);
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const handleSend = () => {
    const message = input.trim();

    if (!message || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(message);
    setWsMessages((prev) => [...prev, `You: ${message}`]);
    setInput('');
  };

  return (
    <main style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h1>App Debug View</h1>
        <p>Status: {status}</p>
        <button type="button" onClick={() => setMobileNavOpen((prev) => !prev)}>
          {mobileNavOpen ? 'Close Menu' : 'Open Menu'}
        </button>
      </header>

      <section style={{ marginBottom: '1rem' }}>
        <h2>API Info</h2>
        <pre>{appInfo ? JSON.stringify(appInfo, null, 2) : 'Loading...'}</pre>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h2>WebSocket Messages</h2>
        <ul>
          {wsMessages.map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Send Message</h2>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message"
        />
        <button type="button" onClick={handleSend}>
          Send
        </button>
      </section>
    </main>
  );
}
          setAppInfo(data);
        }

    fetch(API_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load app info');
        }
        return response.json();
      })
      .then((data) => {
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      setWsMessages((prev) => [...prev, event.data]);
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const handleSend = () => {
    const message = input.trim();

    if (!message || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(message);
    setWsMessages((prev) => [...prev, `You: ${message}`]);
    setInput('');
  };

  return (
    <main style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h1>App Debug View</h1>
        <p>Status: {status}</p>
        <button type="button" onClick={() => setMobileNavOpen((prev) => !prev)}>
          {mobileNavOpen ? 'Close Menu' : 'Open Menu'}
        </button>
      </header>

      <section style={{ marginBottom: '1rem' }}>
        <h2>API Info</h2>
        <pre>{appInfo ? JSON.stringify(appInfo, null, 2) : 'Loading...'}</pre>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h2>WebSocket Messages</h2>
        <ul>
          {wsMessages.map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Send Message</h2>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message"
        />
        <button type="button" onClick={handleSend}>
          Send
        </button>
      </section>
    </main>
  );
}
          setAppInfo(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      setWsMessages((prev) => [...prev, event.data]);
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const handleSend = () => {
    const message = input.trim();

    if (!message || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(message);
    setWsMessages((prev) => [...prev, `You: ${message}`]);
    setInput('');
  };

  return (
    <main style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '1rem' }}>
        <h1>App Debug View</h1>
        <p>Status: {status}</p>
        <button type="button" onClick={() => setMobileNavOpen((prev) => !prev)}>
          {mobileNavOpen ? 'Close Menu' : 'Open Menu'}
        </button>
      </header>

      <section style={{ marginBottom: '1rem' }}>
        <h2>API Info</h2>
        <pre>{appInfo ? JSON.stringify(appInfo, null, 2) : 'Loading...'}</pre>
      </section>

      <section style={{ marginBottom: '1rem' }}>
        <h2>WebSocket Messages</h2>
        <ul>
          {wsMessages.map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Send Message</h2>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type a message"
        />
        <button type="button" onClick={handleSend}>
          Send
        </button>
      </section>
    </main>
  );
}