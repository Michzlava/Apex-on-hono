import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Edit, Loader2 } from 'lucide-react';
import './AdminDashboard.css';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store', credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data.map((u: any) => ({
          ...u,
          name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null,
        })));
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="adm">
      <div className="adm-hdr">
        <div>
          <p className="adm-brand">Apex · Markets</p>
          <h1 className="adm-title">Users</h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>{users.length} total users</p>
          <div className="adm-search-wrap" style={{ width: 200 }}>
            <Search size={13} />
            <input className="adm-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div style={{ background: 'var(--card-adm)', border: '1px solid var(--line-strong)', borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32, gap: 8, color: 'var(--ink-faint)' }}>
              <Loader2 size={16} className="adm-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ padding: '32px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--ink-faint)' }}>No users found</p>
          ) : filtered.map((u: any) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line-strong)' }}>
              <div className="adm-avatar">{u.name ? u.name[0].toUpperCase() : 'U'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unnamed'}</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)' }}>${(u.portfolioBalance || 0).toLocaleString()}</p>
                <Link to={`/dashboard/admin/users/${u.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--surface)', color: 'var(--ink-dim)', borderRadius: 6, fontSize: '0.6rem', fontWeight: 600, textDecoration: 'none', border: '1px solid var(--line-strong)' }}>
                  <Edit size={10} /> Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
