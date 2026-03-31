/**
 * SettingsPanel — API key, model, and provider configuration
 * Normie-friendly: no env vars needed.
 */
import { useState, useEffect } from 'react';
import useGexStore from '../store/useGexStore';
import { getSettings, updateSettings, listModels } from '../services/api';

export default function SettingsPanel() {
  const { showSettings, setShowSettings, addLog } = useGexStore();
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('https://api.aiassist.net');
  const [model, setModel] = useState('moonshotai/kimi-k2-instruct');
  const [provider, setProvider] = useState('groq');
  const [models, setModels] = useState([]);
  const [showKey, setShowKey] = useState(false);
  const [keySet, setKeySet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (showSettings && !loaded) {
      loadCurrent();
      loadModels();
    }
  }, [showSettings]);

  const loadCurrent = async () => {
    try {
      const data = await getSettings();
      if (data.api_base) setApiBase(data.api_base);
      if (data.model) setModel(data.model);
      if (data.provider) setProvider(data.provider);
      setKeySet(data.api_key_set || false);
      setLoaded(true);
    } catch {
      // Backend might not be running yet
    }
  };

  const loadModels = async () => {
    try {
      const data = await listModels();
      setModels(data.models || []);
    } catch {
      // Use defaults
      setModels([
        { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct', provider: 'groq' },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'groq' },
        { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'groq' },
      ]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { model, provider, api_base: apiBase };
      if (apiKey) payload.api_key = apiKey;
      await updateSettings(payload);
      addLog('[+] Settings saved', 'success');
      setShowSettings(false);
      if (apiKey) setKeySet(true);
      
      // Attempt to load full model options now that we have an active token
      loadModels();
    } catch (err) {
      addLog(`[x] Settings save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!showSettings) return null;

  return (
    <div className="settings-overlay" onClick={(e) => {
      if (e.target.classList.contains('settings-overlay')) setShowSettings(false);
    }}>
      <div className="settings-card glass">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          CONFIGURATION
        </h2>
        <p className="subtitle">Configure your AI engine connection</p>

        {/* API Key */}
        <div className="form-group">
          <label className="form-label">API Key</label>
          <div className="input-group">
            <input
              className="form-input"
              type={showKey ? 'text' : 'password'}
              placeholder={keySet ? '••••••• (already set, enter new to change)' : 'aai_your_api_key_here'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="toggle-btn" onClick={() => setShowKey(!showKey)}>
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          {!keySet && (
            <div className="onboarding-notice">
              <strong>First time?</strong> Get your API key from{' '}
              <a href="https://aiassist.net" target="_blank" rel="noopener" style={{ color: 'var(--signal-cyan)' }}>
                aiassist.net
              </a>{' '}
              → Dashboard → API Keys
            </div>
          )}
        </div>

        {/* Model */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ margin: 0 }}>Model</label>
            <button 
              className="btn" 
              onClick={async () => {
                if (apiKey) await updateSettings({ api_key: apiKey, api_base: apiBase });
                await loadModels();
                addLog('[+] Models reloaded from provider', 'info');
              }}
              style={{ fontSize: '0.65rem', padding: '2px 8px', height: '22px', minHeight: 'unset', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> REFRESH
            </button>
          </div>
          <select className="form-select" value={model} onChange={(e) => {
            setModel(e.target.value);
            const m = models.find(m => m.id === e.target.value);
            if (m) setProvider(m.provider);
          }}>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
            ))}
          </select>
        </div>



        {/* API Base */}
        <div className="form-group">
          <label className="form-label">API Base URL</label>
          <input
            className="form-input"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder="https://api.aiassist.net"
          />
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <button className="btn" onClick={() => setShowSettings(false)}>Cancel</button>
          <button className="btn btn-copper" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {saving ? '[ SAVING ]' : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> SAVE</>}
          </button>
        </div>
      </div>
    </div>
  );
}
