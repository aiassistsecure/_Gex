/**
 * SettingsPanel v1.0.0 -- Modal for AI provider config (no emojis)
 * Single dropdown design: select Model + Provider in one click.
 */
import { useState, useEffect } from 'react';
import useGexStore from '../store/useGexStore';
import { getSettings, updateSettings, listModels } from '../services/api';
import { Settings, X, RefreshCw } from 'lucide-react';

export default function SettingsPanel() {
  const { showSettings, setShowSettings } = useGexStore();
  const [settings, setSettings] = useState({
    api_base: 'https://api.aiassist.net',
    api_key: '',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
  });
  const [models, setModels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (showSettings && !loaded) {
      getSettings()
        .then(s => { 
          setSettings(state => ({ ...state, ...s })); 
          setLoaded(true);
          if (s.api_key) fetchModels(s.api_key);
        })
        .catch(() => {});
    }
  }, [showSettings, loaded]);

  const fetchModels = async (key) => {
    setLoadingModels(true);
    try {
      const resp = await listModels(key);
      setModels(resp.models || []);
    } catch {
      // Fallback handled by API
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try { await updateSettings(settings); } catch {}
    setSaving(false);
    setShowSettings(false);
  };

  if (!showSettings) return null;

  // Group models by provider for the optgroup dropdown
  const groupedModels = {};
  for (const m of models) {
    if (!m.provider) continue;
    if (!groupedModels[m.provider]) groupedModels[m.provider] = [];
    groupedModels[m.provider].push(m);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
      <div className="modal-content">
        <div className="modal-header">
          <h2><Settings size={16} style={{ marginRight: '6px', verticalAlign: '-2px' }} />Settings</h2>
          <button className="btn btn-icon btn-sm" onClick={() => setShowSettings(false)}>
            <X size={14} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label className="form-label" style={{ margin: 0 }}>AiAssist API Key</label>
              <button 
                className="btn btn-sm btn-icon" 
                title="Fetch Models"
                onClick={() => fetchModels(settings.api_key)}
                disabled={loadingModels || !settings.api_key}
              >
                <RefreshCw size={12} className={loadingModels ? 'spin' : ''} />
                <span style={{ marginLeft: '4px' }}>Load Models</span>
              </button>
            </div>
            <input className="input" type="password" placeholder="aai_xxxxx..."
              value={settings.api_key}
              onChange={(e) => setSettings(s => ({ ...s, api_key: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Model (Provider implied)</label>
            <select 
              className="input" 
              value={`${settings.provider}::${settings.model}`}
              onChange={(e) => {
                const [provider, model] = e.target.value.split('::');
                setSettings(s => ({ ...s, provider, model }));
              }}
            >
              {Object.keys(groupedModels).length > 0 ? (
                Object.entries(groupedModels).map(([provider, provModels]) => (
                  <optgroup key={provider} label={provider.toUpperCase()}>
                    {provModels.map(m => (
                      <option key={`${m.provider}::${m.id}`} value={`${m.provider}::${m.id}`}>
                        {m.name || m.id}
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : (
                // Fallback option when models haven't loaded yet
                <option value={`${settings.provider}::${settings.model}`}>
                  {settings.provider} — {settings.model}
                </option>
              )}
            </select>
            {Object.keys(groupedModels).length === 0 && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
                Enter your API key and click 'Load Models' to fetch the full list.
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">API Base URL</label>
            <input className="input" value={settings.api_base}
              onChange={(e) => setSettings(s => ({ ...s, api_base: e.target.value }))} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={() => setShowSettings(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
