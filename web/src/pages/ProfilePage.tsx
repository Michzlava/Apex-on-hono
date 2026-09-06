import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './profile.css';

type UserProfile = {
  id: string;
  name: string;
  firstName: string;
  email: string;
  phone?: string;
  country?: string;
  kycStatus: string;
  createdAt: string;
  portfolioBalance: number;
  role: string;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/user/dashboard', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {}
      finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="pf-wrap">
        <div className="pf-inner">
          <div className="pf-skeleton" style={{ height: 84 }} />
          <div className="pf-skeleton" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="pf-wrap">
        <div className="pf-inner">
          <div className="pf-card pf-empty">
            <p>Failed to load profile</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-wrap">
      <div className="pf-inner">

        {/* ══ header ══ */}
        <div className="pf-head">
          <div>
            <p className="pf-eyebrow">
              <span className="pf-eyebrow-pip" />
              Apex · Mkts — Account
            </p>
            <h1 className="pf-title">Profile</h1>
          </div>
          <Link to="/dashboard/settings" className="pf-settings-btn">
            ⚙ Settings
          </Link>
        </div>

        {/* ══ profile hero ══ */}
        <section className="pf-card pf-hero">
          <div className="pf-hero-glow" />
          <div className="pf-avatar">
            <span>{user.firstName?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}</span>
          </div>
          <div className="pf-hero-content">
            <p className="pf-name">{user.firstName || user.name || 'User'}</p>
            <p className="pf-email">{user.email}</p>
            <div className="pf-chips">
              <span className={`pf-kyc-chip ${user.kycStatus.toLowerCase()}`}>
                <span className="pf-kyc-dot" />
                {user.kycStatus}
              </span>
              <span className="pf-role-chip">{user.role}</span>
            </div>
          </div>
        </section>

        {/* ══ account details ══ */}
        <section className="pf-card">
          <header className="pf-card-head">
            <h2>Account Details</h2>
          </header>
          <div className="pf-details">
            <div className="pf-detail-row">
              <span className="pf-detail-lbl">Email</span>
              <span className="pf-detail-val">{user.email}</span>
            </div>
            {user.phone && (
              <div className="pf-detail-row">
                <span className="pf-detail-lbl">Phone</span>
                <span className="pf-detail-val">{user.phone}</span>
              </div>
            )}
            {user.country && (
              <div className="pf-detail-row">
                <span className="pf-detail-lbl">Country</span>
                <span className="pf-detail-val">{user.country}</span>
              </div>
            )}
            <div className="pf-detail-row">
              <span className="pf-detail-lbl">Member Since</span>
              <span className="pf-detail-val">{fmtDate(user.createdAt)}</span>
            </div>
            <div className="pf-detail-row">
              <span className="pf-detail-lbl">Account ID</span>
              <span className="pf-detail-val mono">{user.id}</span>
            </div>
          </div>
        </section>

        {/* ══ portfolio summary ══ */}
        <section className="pf-card">
          <header className="pf-card-head">
            <h2>Portfolio Summary</h2>
          </header>
          <div className="pf-stats">
            <div className="pf-stat">
              <p className="pf-stat-lbl">Current Balance</p>
              <p className="pf-stat-val">{fmtUsd(user.portfolioBalance)}</p>
            </div>
            <div className="pf-stat">
              <p className="pf-stat-lbl">Account Status</p>
              <p className="pf-stat-val">Active</p>
            </div>
          </div>
        </section>

        {/* ══ KYC status ══ */}
        {user.kycStatus !== 'APPROVED' && (
          <section className="pf-card">
            <header className="pf-card-head">
              <h2>Identity Verification</h2>
            </header>
            <div className="pf-kyc-cta">
              <p className="pf-kyc-msg">
                {user.kycStatus === 'NONE' && 'Verify your identity to unlock higher withdrawal limits and full platform access.'}
                {user.kycStatus === 'PENDING' && 'Your documents are under review. This usually takes 1–2 business days.'}
                {user.kycStatus === 'REJECTED' && 'Your previous submission was rejected. Please resubmit with clearer documents.'}
              </p>
              <Link to="/dashboard/kyc" className="pf-kyc-btn">
                {user.kycStatus === 'PENDING' ? 'Check Status' : 'Start Verification'}
              </Link>
            </div>
          </section>
        )}

        {/* ══ quick links ══ */}
        <section className="pf-card">
          <header className="pf-card-head">
            <h2>Quick Links</h2>
          </header>
          <div className="pf-links">
            <Link to="/dashboard/settings" className="pf-link">
              <span className="pf-link-ico">⚙</span>
              <span className="pf-link-text">Account Settings</span>
              <span className="pf-link-arrow">→</span>
            </Link>
            <Link to="/dashboard/kyc" className="pf-link">
              <span className="pf-link-ico">🔒</span>
              <span className="pf-link-text">Identity Verification</span>
              <span className="pf-link-arrow">→</span>
            </Link>
            <Link to="/dashboard/support" className="pf-link">
              <span className="pf-link-ico">💬</span>
              <span className="pf-link-text">Contact Support</span>
              <span className="pf-link-arrow">→</span>
            </Link>
            <Link to="/dashboard/history" className="pf-link">
              <span className="pf-link-ico">📜</span>
              <span className="pf-link-text">Transaction History</span>
              <span className="pf-link-arrow">→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
