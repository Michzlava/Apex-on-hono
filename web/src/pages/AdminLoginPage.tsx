import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please enter email and password'); return; }
    setLoading(true); setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || 'Invalid email or password');
        setLoading(false);
        return;
      }

      // Fetch session to check role
      const sessionRes = await fetch('/api/auth/me', { credentials: 'include' });
      const session    = await sessionRes.json();

      if (session?.user?.role !== 'ADMIN') {
        setError('You do not have admin access');
        setLoading(false);
        return;
      }

      setLoading(false);
      navigate('/dashboard/admin');
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: var(--bg-adm);
          font-family: 'DM Sans', system-ui, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .al-wrap {
          width: 100%;
          max-width: 380px;
          padding: 0 20px;
        }

        .al-logo {
          text-align: center;
          margin-bottom: 36px;
        }

        .al-logo-mark {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #f0ece6;
        }

        .al-logo-mark span { color: #e85c0d; margin: 0 4px; }

        .al-logo-sub {
          font-family: 'DM Mono', monospace;
          font-size: 0.55rem;
          letter-spacing: 0.18em;
          color: #6b6457;
          text-transform: uppercase;
          margin-top: 6px;
        }

        .al-card {
          background: var(--card-adm);
          border-radius: 20px;
          padding: 32px 28px 28px;
        }

        .al-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: #1c1a17;
          letter-spacing: -0.02em;
          margin-bottom: 4px;
        }

        .al-sub {
          font-size: 0.68rem;
          font-weight: 300;
          color: #9e9485;
          margin-bottom: 28px;
        }

        .al-field { margin-bottom: 14px; }

        .al-label {
          display: block;
          font-size: 0.58rem;
          font-weight: 600;
          color: #9e9485;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .al-input {
          width: 100%;
          padding: 11px 14px;
          background: #eeeae4;
          border: 1.5px solid #ddd7cd;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem;
          color: #1c1a17;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }

        .al-input:focus {
          border-color: #e85c0d;
          background: #fff;
        }

        .al-input::placeholder { color: #cbc4b8; }

        .al-error {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 13px;
          background: #faeaea;
          border: 1px solid #e8c8c8;
          border-radius: 8px;
          font-size: 0.68rem;
          color: #b83232;
          margin-bottom: 16px;
        }

        .al-btn {
          width: 100%;
          padding: 13px;
          background: #e85c0d;
          color: #fff;
          border: none;
          border-radius: 11px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 6px;
        }

        .al-btn:hover { opacity: 0.88; }
        .al-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .al-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .al-footer {
          text-align: center;
          margin-top: 20px;
          font-size: 0.6rem;
          color: #6b6457;
          font-family: 'DM Mono', monospace;
          letter-spacing: 0.06em;
        }

        .al-back {
          display: block;
          text-align: center;
          margin-top: 16px;
          font-size: 0.65rem;
          color: #6b6457;
          text-decoration: none;
          transition: color 0.15s;
        }
        .al-back:hover { color: #f0ece6; }
      `}</style>

      <div className="al-wrap">
        <div className="al-logo">
          <p className="al-logo-mark">APEX<span>•</span>MARKETS</p>
          <p className="al-logo-sub">Admin Access</p>
        </div>

        <div className="al-card">
          <p className="al-title">Sign in</p>
          <p className="al-sub">Admin credentials required</p>

          {error && (
            <div className="al-error">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="6" stroke="#b83232" strokeWidth="1.2"/>
                <path d="M6.5 4v3M6.5 9h.01" stroke="#b83232" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <div className="al-field">
            <label className="al-label">Email</label>
            <input
              className="al-input"
              type="email"
              placeholder="admin@apexmarkets.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="email"
            />
          </div>

          <div className="al-field">
            <label className="al-label">Password</label>
            <input
              className="al-input"
              type="password"
              placeholder="••••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
            />
          </div>

          <button className="al-btn" disabled={loading} onClick={handleSubmit}>
            {loading ? <><div className="al-spinner" /> Signing in…</> : 'Sign In'}
          </button>
        </div>

        <p className="al-footer">APEX · MARKETS · ADMIN PORTAL</p>
        <Link to="/login" className="al-back">← Back to user login</Link>
      </div>
    </>
  );
}
