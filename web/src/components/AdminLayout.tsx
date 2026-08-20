import { Link, useLocation, Outlet } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, MessageSquare, Users, TrendingUp,
  ArrowUpToLine, ShieldCheck, CreditCard, Settings, Menu, X
} from 'lucide-react';

const nav = [
  { to: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/admin/deposits', label: 'Deposits', icon: TrendingUp },
  { to: '/dashboard/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpToLine },
  { to: '/dashboard/admin/kyc', label: 'KYC', icon: ShieldCheck },
  { to: '/dashboard/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/dashboard/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-adm)', fontFamily: 'var(--sans)', color: 'var(--ink)' }}>
      {/* Mobile overlay */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        position: open ? 'fixed' : 'sticky',
        top: 0, left: 0, bottom: 0,
        width: 240,
        background: 'var(--card-adm)',
        borderRight: '1px solid var(--line-strong)',
        display: 'flex', flexDirection: 'column',
        zIndex: 100,
        transform: open || window.innerWidth > 768 ? 'none' : 'translateX(-100%)',
        transition: 'transform 0.2s',
      }}>
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--line-strong)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', margin: 0 }}>
              Apex · Markets
            </p>
            <button onClick={() => setOpen(false)} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', marginTop: 4, letterSpacing: '-0.02em' }}>
            Admin
          </p>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + '/');
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600,
                  color: active ? 'var(--bg-adm)' : 'var(--ink-dim)',
                  background: active ? 'var(--accent)' : 'transparent',
                  transition: 'all 0.12s',
                }}
              >
                <Icon size={16} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line-strong)' }}>
          <Link
            to="/dashboard"
            style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', textDecoration: 'none', fontFamily: 'var(--mono)' }}
          >
            ← Back to App
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderBottom: '1px solid var(--line-strong)',
          background: 'var(--card-adm)',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <button
            onClick={() => setOpen(true)}
            style={{ background: 'none', border: 'none', color: 'var(--ink-dim)', cursor: 'pointer', display: 'block' }}
          >
            <Menu size={20} />
          </button>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {nav.find(n => pathname === n.to || pathname.startsWith(n.to + '/'))?.label || 'Admin'}
          </p>
        </header>

        <div style={{ padding: '20px 16px 40px', maxWidth: 960, margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
 
