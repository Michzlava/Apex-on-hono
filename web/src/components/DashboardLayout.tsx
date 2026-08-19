import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Logo } from './Logo';
import { useAuth } from '../context/AuthContext';
import '../pages/dashboard.css';

const navItems = [
  {
    to: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <rect x="1" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="7" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="1" y="7" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
        <rect x="7" y="7" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
  },
  {
    to: '/dashboard/markets',
    label: 'Markets',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M1 10l3-4 2.5 2 3.5-5 2 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" strokeLinejoin="miter" />
      </svg>
    ),
  },
  {
    to: '/dashboard/trade',
    label: 'Trade',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M6.5 4v3l2 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    to: '/dashboard/assets',
    label: 'Assets',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M1 10l3-4 2.5 2 3.5-5 2 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" strokeLinejoin="miter" />
        <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
  },
  {
    to: '/dashboard/deposit',
    label: 'Deposit',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.5 1v8M4 7l2.5 2.5L9 7M1 11h11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    to: '/dashboard/withdraw',
    label: 'Withdraw',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <path d="M6.5 9V1M4 3l2.5-2.5L9 3M1 11h11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    to: '/dashboard/support',
    label: 'Support',
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M6.5 7.5V7c.9 0 1.5-.7 1.5-1.5S7.4 4 6.5 4 5 4.7 5 5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
        <circle cx="6.5" cy="9.5" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/dashboard/notifications',
    label: 'Alerts',
    icon: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
        <path d="M10 2a6 6 0 0 1 6 6c0 3 1 4 1 4H3s1-1 1-4a6 6 0 0 1 6-6z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8.5 16a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/dashboard/kyc',
    label: 'KYC',
    icon: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="7.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
        <path d="M11 8h4M11 11h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/dashboard/subscription',
    label: 'Investment Plans',
    icon: (
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 8h14" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="10" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
];

const ChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
  </svg>
);

const HamburgerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const ChevronLeft = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M6.5 2l-3 3 3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
  </svg>
);

const SunIcon = () => (
  <svg width="20" height="19" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
    <path d="M17 12.3A7 7 0 0 1 7.7 3a7 7 0 1 0 9.3 9.3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
  const moreActive = ['/dashboard/support', '/dashboard/settings', '/dashboard/notifications', '/dashboard/kyc', '/dashboard/subscription'].includes(pathname);
  const isAdmin = pathname.startsWith('/dashboard/admin');

  return (
    <div className="db-shell">

      {/* SIDEBAR — hidden for admin */}
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
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button className="db-signout" onClick={signOut}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M5 2H2v9h3M8 9l3-2.5L8 4M11 6.5H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
              </svg>
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
              <HamburgerIcon />
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
              {theme === 'dark' ? (
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                  <path d="M17 12.3A7 7 0 0 1 7.7 3a7 7 0 1 0 9.3 9.3z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
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
                {theme === 'dark' ? (
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                    <path d="M17 12.3A7 7 0 0 1 7.7 3a7 7 0 1 0 9.3 9.3z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                )}
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
                <ChevronLeft />
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
                <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                  <path d="M5 2H2v9h3M8 9l3-2.5L8 4M11 6.5H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
                </svg>
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
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  <rect x="1" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="7" y="1" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="1" y="7" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
                  <rect x="7" y="7" width="5" height="5" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                <span className="db-bn-label">Home</span>
              </Link>

              <Link to="/dashboard/markets" className={`db-bn-item ${pathname === '/dashboard/markets' ? 'active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  <path d="M1 10l3-4 2.5 2 3.5-5 2 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" strokeLinejoin="miter" />
                </svg>
                <span className="db-bn-label">Markets</span>
              </Link>

              <Link to="/dashboard/trade" className={`db-bn-item ${pathname === '/dashboard/trade' ? 'active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M6.5 4v3l2 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
                </svg>
                <span className="db-bn-label">Trade</span>
              </Link>

              <Link to="/dashboard/assets" className={`db-bn-item ${walletActive ? 'active' : ''}`}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M2 8h16" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="14.5" cy="12" r="1.2" fill="currentColor" />
                  <path d="M6 3l8 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="db-bn-label">Wallet</span>
              </Link>

              <button
                className={`db-bn-item ${moreActive ? 'active' : ''}`}
                onClick={() => setMoreOpen(true)}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                </svg>
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
                      width: '24px',
                      height: '24px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--red)',
                      padding: '0',
                      marginLeft: '8px',
                    }}
                    aria-label="Close"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1l6 6m0 0l6 6M7 7l6-6M7 7L1 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" />
                    </svg>
                  </button>
                </div>
                <div className="db-sheet-rows">
                  {/* Theme toggle row */}
                  <button className="db-sheet-theme-row" onClick={() => { toggleTheme(); }}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>
                      {theme === 'dark' ? (
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path d="M17 12.3A7 7 0 0 1 7.7 3a7 7 0 1 0 9.3 9.3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
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
                      {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
                    </button>
                  </button>
                  <div className="db-sheet-row-divider" />

                  <Link to="/dashboard/support" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>
                      <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
                        <path d="M6.5 7.5V7c.9 0 1.5-.7 1.5-1.5S7.4 4 6.5 4 5 4.7 5 5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
                        <circle cx="6.5" cy="9.5" r="0.6" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Support</span>
                      <span className="db-sheet-row-sub">Get help or contact us</span>
                    </div>
                    <div className="db-sheet-row-arrow"><ChevronRight /></div>
                  </Link>
                  <div className="db-sheet-row-divider" />
                  <Link to="/dashboard/settings" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Settings</span>
                      <span className="db-sheet-row-sub">Account preferences</span>
                    </div>
                    <div className="db-sheet-row-arrow"><ChevronRight /></div>
                  </Link>
                  <div className="db-sheet-row-divider" />
                  <Link to="/dashboard/notifications" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <path d="M10 2a6 6 0 0 1 6 6c0 3 1 4 1 4H3s1-1 1-4a6 6 0 0 1 6-6z" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M8.5 16a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Alerts</span>
                      <span className="db-sheet-row-sub">Notifications &amp; price alerts</span>
                    </div>
                    <div className="db-sheet-row-arrow"><ChevronRight /></div>
                  </Link>
                  <div className="db-sheet-row-divider" />
                  <Link to="/dashboard/kyc" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
                        <circle cx="7.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                        <path d="M11 8h4M11 11h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">KYC</span>
                      <span className="db-sheet-row-sub">Identity verification</span>
                    </div>
                    <div className="db-sheet-row-arrow"><ChevronRight /></div>
                  </Link>
                  <div className="db-sheet-row-divider" />
                  <Link to="/dashboard/subscription" className="db-sheet-row" onClick={() => setMoreOpen(false)}>
                    <div className="db-sheet-row-icon" style={{ color: 'var(--ink-dim)' }}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M3 8h14" stroke="currentColor" strokeWidth="1.3" />
                        <circle cx="10" cy="12" r="1.2" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="db-sheet-row-text">
                      <span className="db-sheet-row-label">Investment Plans</span>
                      <span className="db-sheet-row-sub">Manage your plan</span>
                    </div>
                    <div className="db-sheet-row-arrow"><ChevronRight /></div>
                  </Link>
                </div>
                <button
                  className="db-sheet-signout-row"
                  onClick={() => { setMoreOpen(false); signOut(); }}
                >
                  <div className="db-sheet-row-icon" style={{ color: 'var(--red)' }}>
                    <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
                      <path d="M5 2H2v9h3M8 9l3-2.5L8 4M11 6.5H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
                    </svg>
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
