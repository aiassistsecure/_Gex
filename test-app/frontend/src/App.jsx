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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);


        }
        return response.json();
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };