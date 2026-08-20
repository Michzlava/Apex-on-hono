import { Link, useLocation, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, TrendingUp, ArrowUpToLine,
  ShieldCheck, CreditCard, Settings, Menu, X
} from 'lucide-react';
import './AdminDashboard.css';

const nav = [
  { to: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/admin/users', label: 'Users', icon: Users },
  { to: '/dashboard/admin/deposits', label: 'Deposits', icon: TrendingUp },
  { to: '/dashboard/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpToLine },
  { to: '/dashboard/admin/kyc', label: 'KYC', icon: ShieldCheck },
  { to: '/dashboard/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/dashboard/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="adm-layout">
      {open && isMobile && <div className="adm-layout-overlay" onClick={() => setOpen(false)} />}

      <aside className={`adm-sidebar${open ? ' open' : ''}${isMobile ? ' mobile' : ''}`}>
        <div className="adm-sidebar-head">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="adm-brand">Apex · Markets</p>
            {isMobile && <button onClick={() => setOpen(false)} className="adm-sidebar-close"><X size={18} /></button>}
          </div>
          <p className="adm-sidebar-title">Admin</p>
        </div>

        <nav className="adm-sidebar-nav">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + '/');
            return (
              <Link key={to} to={to} onClick={() => setOpen(false)} className={`adm-nav-link${active ? ' active' : ''}`}>
                <Icon size={16} strokeWidth={1.8} />{label}
              </Link>
            );
          })}
        </nav>

        <div className="adm-sidebar-foot">
          <Link to="/dashboard" className="adm-back-link">← Back to App</Link>
        </div>
      </aside>

      <main className="adm-main">
        <header className="adm-main-header">
          <button onClick={() => setOpen(true)} className="adm-menu-btn"><Menu size={20} /></button>
          <p className="adm-page-label">
            {nav.find(n => pathname === n.to || pathname.startsWith(n.to + '/'))?.label || 'Admin'}
          </p>
        </header>
        <div className="adm-main-content"><Outlet /></div>
      </main>
    </div>
  );
}
