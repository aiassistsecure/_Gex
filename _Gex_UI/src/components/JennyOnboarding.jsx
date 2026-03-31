/**
 * JennyOnboarding — First-launch BYOK screen for AiAssist _Gex IDE
 * Shows when no API key is configured. Links to aiassist.net for key retrieval.
 */
import { useState } from 'react';
import { ExternalLink, ArrowRight, Key, Zap } from 'lucide-react';
import { updateSettings, validateApiKey } from '../services/api';
import useGexStore from '../store/useGexStore';

const FEATURES = [
  { icon: '⚡', title: 'Surgical Patches', desc: 'LLM-generated hunks you approve line by line' },
  { icon: '🧊', title: 'Freeze & Restore', desc: 'Snapshot your workspace before any risky change' },
  { icon: '🔍', title: 'Repo-wide Agentic Scans', desc: 'Full codebase exploration with real-time tool streaming' },
];

export default function JennyOnboarding({ onComplete }) {
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { addLog } = useGexStore();

  const handleStart = async () => {
    const key = apiKey.trim();
    if (!key) { setError('API key is required to continue.'); return; }
    setSaving(true);
    setError('');
    try {
      // Validate against AiAssist API before saving
      const validation = await validateApiKey(key);
      if (!validation.valid) {
        setError(validation.error || 'Invalid API key — please check and try again.');
        return;
      }
      await updateSettings({ api_key: key });
      localStorage.setItem('jenny_onboarded', '1');
      addLog('Jenny configured — welcome aboard.', 'success');
      onComplete();
    } catch (e) {
      setError('Could not reach backend — is Jenny running?');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1421 40%, #0a1628 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', 'Outfit', sans-serif",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,122,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: '480px', padding: '0 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px',
        position: 'relative', zIndex: 1,
      }}>

        {/* Logo + Brand */}
        <div style={{ textAlign: 'center' }}>
          <img
            src="/jenny-logo.png"
            alt="AiAssist"
            style={{ width: '52px', height: '52px', borderRadius: '12px', marginBottom: '16px', display: 'block', margin: '0 auto 16px' }}
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '3px', color: 'rgba(0,122,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>
            AiAssist SECURE
          </div>
          <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            Meet Jenny
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: '15px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            Your AI coding agent — powered by _Gex,<br />the surgical code runner built for precision.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px', padding: '10px 14px',
            }}>
              <span style={{ fontSize: '18px' }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{f.title}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* API Key card */}
        <div style={{
          width: '100%', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Key size={13} color="rgba(0,122,255,0.8)" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              AiAssist API Key
            </span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
            Don't have one?{' '}
            <a
              href="https://aiassist.net"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#007aff', textDecoration: 'none', fontWeight: 500 }}
            >
              Get yours at aiassist.net
              <ExternalLink size={10} style={{ marginLeft: '3px', verticalAlign: 'middle' }} />
            </a>
          </p>

          <input
            type="password"
            placeholder="sk-••••••••••••••••••"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(0,0,0,0.3)', border: `1px solid ${error ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '8px', padding: '10px 12px',
              color: '#fff', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
            }}
          />
          {error && (
            <div style={{ fontSize: '11px', color: 'rgba(255,80,80,0.9)', marginTop: '6px' }}>{error}</div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={saving || !apiKey.trim()}
          style={{
            width: '100%', padding: '13px 20px',
            background: apiKey.trim() ? 'linear-gradient(135deg, #007aff, #0055cc)' : 'rgba(255,255,255,0.06)',
            border: 'none', borderRadius: '10px', cursor: apiKey.trim() ? 'pointer' : 'not-allowed',
            color: apiKey.trim() ? '#fff' : 'rgba(255,255,255,0.25)',
            fontSize: '14px', fontWeight: 600, letterSpacing: '0.3px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          {saving ? 'Saving...' : (
            <>
              <Zap size={15} />
              Initialize Jenny
              <ArrowRight size={15} />
            </>
          )}
        </button>

        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
          Your key is stored locally and never leaves your machine.
          <br />
          Change it anytime in Settings.
        </div>
      </div>
    </div>
  );
}
