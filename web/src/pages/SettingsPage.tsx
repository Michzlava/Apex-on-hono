import { useState, useEffect, useCallback } from 'react';
import './settings.css';

type Profile = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  country: string | null;
};

const PREFS_KEY = 'apex-notif-prefs';
const DEFAULT_PREFS = { priceAlerts: true, tradeConfirmations: true, productUpdates: false };

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', country: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/settings', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setProfile(d);
        setForm({
          firstName: d.firstName ?? '',
          lastName: d.lastName ?? '',
          phone: d.phone ?? '',
          country: d.country ?? '',
        });
      }
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const saveProfile = async () => {
    setSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Failed to save');
      setProfileMsg({ ok: true, text: 'Profile updated' });
    } catch (e: any) {
      setProfileMsg({ ok: false, text: e.message });
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (pw.next !== pw.confirm) return setPwMsg({ ok: false, text: 'New passwords do not match' });
    if (pw.next.length < 8) return setPwMsg({ ok: false, text: 'Password must be at least 8 characters' });
    setChangingPw(true);
    try {
      const res = await fetch('/api/user/settings/password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Failed to change password');
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ ok: true, text: 'Password changed successfully' });
    } catch (e: any) {
      setPwMsg({ ok: false, text: e.message });
    } finally { setChangingPw(false); }
  };

  const togglePref = (key: keyof typeof DEFAULT_PREFS) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  };

  if (loading) {
    return (
      <div className="st-wrap">
        <div className="st-inner">
          <div className="st-skeleton" style={{ height: 60 }} />
          <div className="st-skeleton" style={{ height: 220 }} />
          <div className="st-skeleton" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="st-wrap">
      <div className="st-inner">

        {/* ══ header ═ */}
        <div className="st-head">
          <p className="st-eyebrow"><span className="st-eyebrow-pip" />Apex · Mkts — Account</p>
          <h1 className="st-title">Settings</h1>
        </div>

        {/* ══ profile ══ */}
        <section className="st-card">
          <header className="st-card-head">
            <h2>Profile</h2>
          </header>
          <div className="st-grid">
            <div className="st-field">
              <label className="st-lbl">First Name</label>
              <input className="st-input" value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div className="st-field">
              <label className="st-lbl">Last Name</label>
              <input className="st-input" value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="st-field">
              <label className="st-lbl">Phone</label>
              <input className="st-input" value={form.phone} placeholder="+1 …"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="st-field">
              <label className="st-lbl">Country</label>
              <input className="st-input" value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
            </div>
            <div className="st-field full">
              <label className="st-lbl">Email (login ID — cannot be changed)</label>
              <input className="st-input ro" value={profile?.email ?? ''} disabled />
            </div>
          </div>
          <div className="st-actions">
            <button className="st-btn" onClick={saveProfile} disabled={saving}>
              {saving ? 'SAVING…' : 'SAVE CHANGES'}
            </button>
            {profileMsg && (
              <span className={`st-msg ${profileMsg.ok ? 'ok' : 'err'}`}>{profileMsg.text}</span>
            )}
          </div>
        </section>

        {/* ══ security ══ */}
        <section className="st-card">
          <header className="st-card-head">
            <h2>Security</h2>
          </header>
          <div className="st-grid">
            <div className="st-field full">
              <label className="st-lbl">Current Password</label>
              <input className="st-input" type="password" value={pw.current}
                onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
            </div>
            <div className="st-field">
              <label className="st-lbl">New Password</label>
              <input className="st-input" type="password" value={pw.next}
                onChange={e => setPw(p => ({ ...p, next: e.target.value }))} />
            </div>
            <div className="st-field">
              <label className="st-lbl">Confirm New Password</label>
              <input className="st-input" type="password" value={pw.confirm}
                onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
            </div>
          </div>
          <div className="st-actions">
            <button className="st-btn" onClick={changePassword}
              disabled={changingPw || !pw.current || !pw.next}>
              {changingPw ? 'UPDATING…' : 'UPDATE PASSWORD'}
            </button>
            {pwMsg && <span className={`st-msg ${pwMsg.ok ? 'ok' : 'err'}`}>{pwMsg.text}</span>}
          </div>
          <div className="st-row">
            <div>
              <p className="st-row-title">Two-Factor Authentication</p>
              <p className="st-row-sub">Require a code at login for extra protection</p>
            </div>
            <span className="st-chip-soon">COMING SOON</span>
          </div>
        </section>

        {/* ══ notifications ══ */}
        <section className="st-card">
          <header className="st-card-head">
            <h2>Notifications</h2>
          </header>
          {([
            { key: 'priceAlerts',        t: 'Price Alerts',        d: 'Alerts when watched assets move sharply' },
            { key: 'tradeConfirmations', t: 'Trade Confirmations', d: 'Receipts for every filled order' },
            { key: 'productUpdates',     t: 'Product Updates',     d: 'New features and platform news' },
          ] as const).map(row => (
            <div className="st-row" key={row.key}>
              <div>
                <p className="st-row-title">{row.t}</p>
                <p className="st-row-sub">{row.d}</p>
              </div>
              <button
                className={`st-toggle ${prefs[row.key] ? 'on' : ''}`}
                onClick={() => togglePref(row.key)}
                aria-label={`Toggle ${row.t}`}
              >
                <span className="st-toggle-knob" />
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
