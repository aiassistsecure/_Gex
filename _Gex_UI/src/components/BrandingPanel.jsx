/**
 * BrandingPanel — Let builders customize their app identity before packaging.
 * Writes directly to gene.config.json + package.json in the loaded workspace.
 */
import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:18764/api/branding';

const Field = ({ label, hint, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
      <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {label}
      </label>
      {hint && <span style={{ fontSize: '0.58rem', color: 'var(--text-dim)' }}>{hint}</span>}
    </div>
    {children}
  </div>
);

export default function BrandingPanel({ repo }) {
  const [form, setForm]         = useState({
    appName: '', productName: '', appId: '', version: '1.0.0',
    description: '', accentColor: '#e85d04', logoPath: '',
  });
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUrl, setLogoUrl]         = useState('');
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [saved, setSaved]             = useState(false);
  const [iconStatus, setIconStatus]   = useState(null);
  const [error, setError]             = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (!repo) return;
    fetch(API)
      .then(r => r.json())
      .then(d => {
        setForm(prev => ({ ...prev, ...d }));
        if (d.logoPath) setLogoPreview(`http://localhost:18764/assets/${d.logoPath.split('/').pop()}`);
      })
      .catch(() => {});
  }, [repo]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true); setError(''); setIconStatus(null);
    setLogoPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/logo`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.logo) {
        set('logoPath', data.logo);
        setIconStatus(data.icons);
      }
    } catch (e) { setError('Upload failed: ' + e.message); }
    finally { setUploading(false); }
  };

  const handleUrlFetch = async () => {
    if (!logoUrl.trim()) return;
    setUploading(true); setError(''); setIconStatus(null);
    try {
      const res = await fetch(`${API}/logo-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: logoUrl.trim() }),
      });
      const data = await res.json();
      if (data.logo) {
        set('logoPath', data.logo);
        setLogoPreview(logoUrl.trim());
        setIconStatus(data.icons);
        setLogoUrl('');
      } else {
        setError(data.error || 'Failed to fetch logo');
      }
    } catch (e) { setError('Fetch failed: ' + e.message); }
    finally { setUploading(false); }
  };

  if (!repo) return (
    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-size-sm)' }}>
      <div style={{ fontSize: '28px', marginBottom: '10px' }}>🎨</div>
      Load a project first to configure branding
    </div>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--accent-orange)', letterSpacing: '2px', textTransform: 'uppercase' }}>
          🎨 App Branding
        </div>
        <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '3px' }}>
          Writes to gene.config.json & package.json
        </div>
      </div>

      {/* Logo */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
          App Icon
        </label>

        {/* Preview + drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 12px',
            background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)',
            border: '1px dashed var(--border-default)', cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-orange)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
        >
          {logoPreview
            ? <img src={logoPreview} alt="logo" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-default)' }} />
            : <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🖼</div>
          }
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {uploading ? 'Processing icons...' : 'Click to browse'}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              PNG/JPG/SVG → auto-generates .ico + all sizes
            </div>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => handleFileUpload(e.target.files[0])} />

        {/* URL input */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <input
            className="input input-sm" placeholder="…or paste image URL"
            value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUrlFetch()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-sm" disabled={!logoUrl.trim() || uploading} onClick={handleUrlFetch}>
            {uploading ? '...' : 'Fetch'}
          </button>
        </div>

        {iconStatus && (
          <div style={{ marginTop: '6px', fontSize: '0.6rem', color: iconStatus.ico ? 'var(--accent-green)' : 'var(--accent-yellow)', padding: '4px 8px', background: 'var(--surface-1)', borderRadius: '4px' }}>
            {iconStatus.ico ? `✅ Icons generated via ${iconStatus.method}` : `⚠ ${iconStatus.warning || 'Icon generation skipped'}`}
          </div>
        )}
      </div>

      {/* Identity fields */}
      <Field label="App Name">
        <input className="input input-sm" value={form.appName}
          onChange={e => { set('appName', e.target.value); set('productName', e.target.value); }}
          placeholder="My Awesome App" />
      </Field>

      <Field label="App ID" hint="com.company.app">
        <input className="input input-sm" value={form.appId}
          onChange={e => set('appId', e.target.value)}
          placeholder="com.acme.myapp" />
      </Field>

      <Field label="Version" hint="semver">
        <input className="input input-sm" value={form.version}
          onChange={e => set('version', e.target.value)}
          placeholder="1.0.0" />
      </Field>

      <Field label="Description">
        <textarea className="input input-sm" value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="One-liner about your app"
          style={{ resize: 'vertical', minHeight: '52px', fontFamily: 'var(--font-sans)' }} />
      </Field>

      {/* Accent color */}
      <Field label="Accent Color" hint="Used in UI theme">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="color" value={form.accentColor}
            onChange={e => set('accentColor', e.target.value)}
            style={{ width: '36px', height: '28px', padding: '2px', border: '1px solid var(--border-default)', borderRadius: '4px', background: 'var(--surface-1)', cursor: 'pointer' }}
          />
          <input className="input input-sm" value={form.accentColor}
            onChange={e => set('accentColor', e.target.value)}
            style={{ flex: 1, fontFamily: 'var(--font-mono)' }} />
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: form.accentColor, border: '1px solid var(--border-default)', flexShrink: 0 }} />
        </div>
      </Field>

      {/* Save */}
      {error && (
        <div style={{ fontSize: '0.65rem', color: 'var(--accent-red)', padding: '6px 8px', background: 'rgba(230,57,70,0.08)', borderRadius: '4px', marginBottom: '8px' }}>
          {error}
        </div>
      )}

      <button
        className={`btn btn-primary btn-sm`}
        style={{ width: '100%', marginTop: '4px', padding: '7px', fontWeight: 600 }}
        disabled={saving}
        onClick={handleSave}
      >
        {saved ? '✅ Saved!' : saving ? 'Saving...' : '💾 Save Branding'}
      </button>

      <div style={{ fontSize: '0.58rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '6px' }}>
        Changes apply on next <span style={{ color: 'var(--accent-orange)' }}>jenny build</span>
      </div>
    </div>
  );
}
