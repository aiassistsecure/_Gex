/**
 * SettingsPanel v1.0.0 -- Modal for AI provider config (no emojis)
 */
import { useState, useEffect } from 'react';
import useGexStore from '../store/useGexStore';
import { getSettings, updateSettings, listModels } from '../services/api';
import { Settings, X } from 'lucide-react';

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (showSettings && !loaded) {
      getSettings()
        .then(s => { setSettings(s); setLoaded(true); })
        .catch(() => {});
      listModels()
        .then(m => setModels(m.models || []))
        .catch(() => {});
    }
  }, [showSettings, loaded]);

  const handleSave = async () => {
    setSaving(true);
    try { await updateSettings(settings); } catch {}
    setSaving(false);
    setShowSettings(false);
  };

  if (!showSettings) return null;

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
            <label className="form-label">AiAssist API Key</label>
            <input className="input" type="password" placeholder="aai_xxxxx..."
              value={settings.api_key}
              onChange={(e) => setSettings(s => ({ ...s, api_key: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Provider</label>
            <select className="input" value={settings.provider}
              onChange={(e) => setSettings(s => ({ ...s, provider: e.target.value }))}>
              <option value="groq">Groq</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
              <option value="mistral">Mistral</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Model</label>
            <input className="input" placeholder="e.g. llama-3.3-70b-versatile"
              value={settings.model}
              onChange={(e) => setSettings(s => ({ ...s, model: e.target.value }))} />
            {models.length > 0 && (
              <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {models.slice(0, 6).map(m => (
                  <button key={m.id} className="btn btn-sm"
                    onClick={() => setSettings(s => ({ ...s, model: m.id }))}
                    style={{ fontSize: 'var(--font-size-xs)' }}>
                    {m.name || m.id}
                  </button>
                ))}
              </div>
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
