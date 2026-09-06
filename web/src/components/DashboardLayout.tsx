import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import '../pages/dashboard.css';

/* ═══════════════════════════════════════════════════════════════════
   Institutional-style icons (Lucide-derived, 20×20 viewBox)
   ═══════════════════════════════════════════════════════════════════ */
const Icons = {
  overview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  markets: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  trade: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17l10-10M17 17L7 7" />
      <polyline points="17 7 17 17 7 17" />
    </svg>
  ),
  assets: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),
  deposit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M3 21h18" />
    </svg>
  ),
  withdraw: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V7" />
      <path d="m17 12-5-5-5 5" />
      <path d="M3 3h18" />
    </svg>
  ),
  support: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  ),
  alerts: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  kyc: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  signout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  themeDark: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  themeLight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  chevronRight: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  chevronLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  hamburger: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  more: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  ),
};

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: Icons.overview },
  { to: '/dashboard/markets', label: 'Markets', icon: Icons.markets },
  { to: '/dashboard/trade', label: 'Trade', icon: Icons.trade },
  { to: '/dashboard/assets', label: 'Assets', icon: Icons.assets },
  { to: '/dashboard/deposit', label: 'Deposit', icon: Icons.deposit },
  { to: '/dashboard/withdraw', label: 'Withdraw', icon: Icons.withdraw },
  { to: '/dashboard/support', label: 'Support', icon: Icons.support },
  { to: '/dashboard/settings', label: 'Settings', icon: Icons.settings },
  { to: '/dashboard/notifications', label: 'Alerts', icon: Icons.alerts },
  { to: '/dashboard/kyc', label: 'KYC', icon: Icons.kyc },
  { to: '/dashboard/profile', label: 'Profile', icon: Icons.profile },
];

const SunIcon = Icons.themeLight;
const MoonIcon = Icons.themeDark;

export default function DashboardLayout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('apex-theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('apex-theme', next);
    if (next === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const walletActive = pathname === '/dashboard/assets';
  const moreActive = [
    '/dashboard/support',
    '/dashboard/settings',
    '/dashboard/notifications',
    '/dashboard/kyc',
    '/dashboard/profile',
  ].includes(pathname);
  const isAdmin = pathname.startsWith('/dashboard/admin');

  return (
    <div className="db-shell">
      {/* SIDEBAR */}
      {!isAdmin && (
        <aside className="db-sidebar">
          <div className="db-sidebar-logo">
            <Logo />
          </div>
          <nav className="db-nav">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`db-nav-item ${pathname === item.to ? 'active' : ''}`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="db-sidebar-footer">
            <button className="db-theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? Icons.themeLight : Icons.themeDark}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button className="db-signout" onClick={signOut}>
              {Icons.signout}
              Sign Out
            </button>
          </div>
        </aside>
      )}

      {/* MOBILE TOPBAR */}
      <div className="db-mobile-bar">
        <div className="db-mobile-bar-left">
          {!isAdmin && (
            <button className="db-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
              {Icons.hamburger}
            </button>
          )}
          <span className="db-mobile-logo">APEX<span>•</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className={`db-theme-switch ${theme === 'light' ? 'active' : ''}`}
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <div className="db-theme-switch-knob">
              {theme === 'dark' ? MoonIcon : SunIcon}
            </div>
          </button>
        </div>
      </div>

      {/* MAIN */}
      <main className={`db-main${isAdmin ? ' db-main-full' : ''}`}>
        <div className="db-topbar">
          <span className="db-topbar-title">
            {navItems.find((n) => n.to === pathname)?.label ?? 'Dashboard'}
          </span>
          <div className="db-topbar-right">
            <button
              className={`db-theme-switch ${theme === 'light' ? 'active' : ''}`}
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <div className="db-theme-switch-knob">
                {theme === 'dark' ? MoonIcon : SunIcon}
              </div>
            </button>
            <span className="db-topbar-sep">·</span>
            <span>APEX MARKETS</span>
            <span className="db-topbar-sep">·</span>
            <span>Trading Terminal</span>
          </div>
        </div>
        <div className="db-content">
          <Outlet />
        </div>
      </main>

      {/* MOBILE SIDEBAR */}
      {mounted && !isAdmin && (
        <>
          <div
            className={`db-mobile-sidebar-overlay ${sidebarOpen ? 'dbMobileSidebarOpen' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />
          <div className={`db-mobile-sidebar ${sidebarOpen ? 'dbMobileSidebarOpen' : ''}`}>
            <div className="db-mobile-sidebar-header">
              <span className="db-mobile-sidebar-logo">APEX<span>•</span>MARKETS</span>
              <button className="db-mobile-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                {Icons.close}
              </button>
            </div>
            <div className="db-mobile-sidebar-content">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="db-mobile-sidebar-row"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-dim)' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="db-mobile-sidebar-footer">
              <button
                className="db-mobile-sidebar-row"
                style={{ color: 'var(--red)' }}
                onClick={() => { setSidebarOpen(false); signOut(); }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  {Icons.signout}
                </span>
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* BOTTOM NAV + MORE SHEET */}
      {!isAdmin && (
        <>
          <nav className="db-bottom-nav">
            <div className="db-bottom-nav-inner">
              <Link to="/dashboard" className={`db-bn-item ${pathname === '/dashboard' ? 'active' : ''}`}>
                {Icons.overview}
                <span className="db-bn-label">Home</span>
              </Link>
              <Link to="/dashboard/markets" className={`db-bn-item ${pathname === '/dashboard/markets' ? 'active' : ''}`}>
                {Icons.markets}
                <span className="db-bn-label">Markets</span>
              </Link>
              <Link to="/dashboard/trade" className={`db-bn-item ${pathname === '/dashboard/trade' ? 'active' : ''}`}>
                {Icons.trade}
                <span className="db-bn-label">Trade</span>
              </Link>
              <Link to="/dashboard/assets" className={`db-bn-item ${walletActive ? 'active' : ''}`}>
                {Icons.assets}
                <span className="db-bn-label">Wallet</span>
              </Link>
              <button
                className={`db-bn-item ${moreActive ? 'active' : ''}`}
                onClick={() => setMoreOpen(true)}
              >
                {Icons.more}
                <span className="db-bn-label">Account</span>
              </button>
            </div>
          </nav>

          {/* MORE SHEET */}
          {moreOpen && (
            <>
              <div className="db-sheet-overlay" onClick={() => setMoreOpen(false)} />
              <div className="db-sheet">
                <div className="db-sheet-handle" />
                <div className="db-sheet-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>More</span>
                  <button
                    onClick={() => setMoreOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      background: 'var(--bg-3)',
                      border: '1px solid var(--line-strong)',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      color: 'var(--red)',
                      padding: '0',
                      marginLeft: '8px',
                    }}
                    aria-label="Close"
                  >
                    {Icons.close}
                  </button>
                </div>
                <div className="db-sheet-rows">
                  {/* Theme toggle row */}
                  <button className="db-sheet-theme-row" onClick={toggleTheme}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>
                      {theme === 'dark' ? Icons.themeLight : Icons.themeDark}
                    </div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Theme</span>
                      <span className="db-sheet-row-sub">Currently {theme === 'dark' ? 'dark' : 'light'} mode</span>
                    </div>
                    <span className="db-sheet-theme-status">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                    <button
                      className="db-sheet-theme-toggle-btn"
                      onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                      aria-label="Toggle theme"
                    >
                      {theme === 'dark' ? MoonIcon : SunIcon}
                    </button>
                  </button>
                  <div className="db-sheet-row-divider" />

                  <Link to="/dashboard/profile" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>{Icons.profile}</div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Profile</span>
                      <span className="db-sheet-row-sub">Your account details</span>
                    </div>
                    <div className="db-sheet-row-arrow">{Icons.chevronRight}</div>
                  </Link>
                  <div className="db-sheet-row-divider" />
                  <Link to="/dashboard/support" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>{Icons.support}</div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Support</span>
                      <span className="db-sheet-row-sub">Get help or contact us</span>
                    </div>
                    <div className="db-sheet-row-arrow">{Icons.chevronRight}</div>
                  </Link>
                  <div className="db-sheet-row-divider" />
                  <Link to="/dashboard/settings" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>{Icons.settings}</div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Settings</span>
                      <span className="db-sheet-row-sub">Account & security</span>
                    </div>
                    <div className="db-sheet-row-arrow">{Icons.chevronRight}</div>
                  </Link>
                  <div className="db-sheet-row-divider" />
                  <Link to="/dashboard/notifications" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>{Icons.alerts}</div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Alerts</span>
                      <span className="db-sheet-row-sub">Notifications & price alerts</span>
                    </div>
                    <div className="db-sheet-row-arrow">{Icons.chevronRight}</div>
                  </Link>
                  <div className="db-sheet-row-divider" />
                  <Link to="/dashboard/kyc" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>{Icons.kyc}</div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">KYC</span>
                      <span className="db-sheet-row-sub">Identity verification</span>
                    </div>
                    <div className="db-sheet-row-arrow">{Icons.chevronRight}</div>
                  </Link>
                </div>
                <button
                  className="db-sheet-signout-row"
                  onClick={() => { setMoreOpen(false); signOut(); }}
                >
                  <div className="db-sheet-row-icon" style={{ color: 'var(--red)' }}>
                    {Icons.signout}
                  </div>
                  <span className="db-sheet-signout-label">Sign Out</span>
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
