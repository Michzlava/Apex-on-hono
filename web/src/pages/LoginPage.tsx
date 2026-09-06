import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(form.email, form.password);

    if (!result.success) {
      setError(result.error || 'Invalid credentials');
      setLoading(false);
    } else {
      const redirect = searchParams.get('redirect') || '/dashboard';
      navigate(redirect);
    }
  }

  return (
    <div className="li-wrap">
      {/* Background glows */}
      <div className="li-glows">
        <div className="li-glow li-glow-1" />
        <div className="li-glow li-glow-2" />
      </div>

      <div className="li-container">

        {/* Logo */}
        <div className="li-a1 li-logo-wrap">
          <Link to="/" className="li-logo">
            <div className="li-logo-box">AP</div>
            <span className="li-logo-text">APEX<span>·</span>MKTS</span>
          </Link>
        </div>

        {/* Card */}
        <div className="li-card">

          {/* Header */}
          <div className="li-a2 li-head">
            <div className="li-badge">
              <span className="li-badge-dot" />
              Secure Login
            </div>
            <h1 className="li-title">Welcome back</h1>
            <p className="li-sub">Sign in to access your portfolio</p>
          </div>

          {/* Error */}
          {error && <div className="li-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="li-a3 li-field">
              <label className="li-label">Email Address</label>
              <input
                className="li-input"
                type="email"
                required
                placeholder="name@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="li-a3 li-field li-field-pw">
              <div className="li-field-head">
                <label className="li-label" style={{ margin: 0 }}>Password</label>
                <Link to="/forgot-password" className="li-forgot">FORGOT?</Link>
              </div>
              <input
                className="li-input"
                type="password"
                required
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
              />
            </div>

            {/* Submit */}
            <div className="li-a4">
              <button type="submit" disabled={loading} className="li-btn">
                {loading ? (
                  <svg className="li-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <>Sign In →</>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="li-a5 li-divider">
            <p>
              Don't have an account?{' '}
              <Link to="/signup" className="li-link">Create Account</Link>
            </p>
          </div>

        </div>

        {/* Footer note */}
        <div className="li-a5 li-footer">
          <p>Trading involves risk · Only invest what you can afford to lose</p>
        </div>

      </div>
    </div>
  );
}
