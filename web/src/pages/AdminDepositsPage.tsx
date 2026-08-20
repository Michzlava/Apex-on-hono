import { useState, useEffect, useCallback } from 'react';
import { Loader2, Clock, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import './AdminDashboard.css';

interface Deposit {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  methodLabel?: string;
  note?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  user: { name?: string; email?: string };
}

function DepositActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [loading, setL] = useState<'COMPLETED' | 'REJECTED' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const act = async (action: 'COMPLETED' | 'REJECTED') => {
    setL(action); setError('');
    const res = await fetch(`/api/admin/deposits/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action, adminNote: note || undefined }),
    });
    setL(null);
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return; }
    setDone(true); onDone();
  };

  if (done) return <p className="adm-done-ok">✓ Processed</p>;
  return (
    <div className="adm-action-wrap">
      <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Admin note (optional)" className="adm-note-input" />
      {error && <p className="adm-err">{error}</p>}
      <div className="adm-action-btns">
        <button onClick={() => act('COMPLETED')} disabled={!!loading} className="adm-btn-approve">
          {loading === 'COMPLETED' ? <Loader2 className="adm-spin" size={14} /> : <CheckCircle size={14} />} Confirm
        </button>
        <button onClick={() => act('REJECTED')} disabled={!!loading} className="adm-btn-reject">
          {loading === 'REJECTED' ? <Loader2 className="adm-spin" size={14} /> : <XCircle size={14} />} Reject
        </button>
      </div>
    </div>
  );
}

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeposits = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deposits', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setDeposits(d.deposits ?? []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const pendingDeps = deposits.filter(d => d.status === 'PENDING');

  return (
    <div className="adm">
      <div className="adm-hdr">
        <div>
          <p className="adm-brand">Apex · Markets</p>
          <h1 className="adm-title">Deposits</h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div className="adm-empty"><Loader2 size={18} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>
        ) : pendingDeps.length === 0 && deposits.filter(d => d.status !== 'PENDING').length === 0 ? (
          <div className="adm-empty"><TrendingUp size={28} style={{ opacity: 0.25 }} /><p>No deposit submissions yet</p></div>
        ) : (
          <>
            {pendingDeps.length > 0 && (
              <div>
                <div className="adm-sec-label">
                  <Clock size={13} style={{ color: 'var(--gold)' }} />
                  <span>Awaiting Confirmation</span>
                  <span className="adm-status pending">{pendingDeps.length}</span>
                </div>
                {pendingDeps.map(d => (
                  <div key={d.id} className="adm-card">
                    <div className="adm-card-stripe" style={{ background: 'var(--gold)' }} />
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="adm-avatar">{(d.user?.name || d.user?.email || '?')[0].toUpperCase()}</div>
                        <div>
                          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)' }}>{d.user?.name || 'Unknown'}</p>
                          <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)' }}>{d.user?.email}</p>
                          {d.methodLabel && <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', marginTop: 2 }}>via {d.methodLabel}</p>}
                          <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', marginTop: 2 }}>{new Date(d.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)' }}>${d.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)' }}>{d.currency || 'USD'}</p>
                      </div>
                    </div>
                    {d.note && <p style={{ marginTop: 10, padding: '7px 12px', background: 'var(--gold-l)', borderRadius: 8, fontSize: '0.65rem', color: 'var(--gold)', fontStyle: 'italic' }}>"{d.note}"</p>}
                    <DepositActions id={d.id} onDone={fetchDeposits} />
                  </div>
                ))}
              </div>
            )}
            {deposits.filter(d => d.status !== 'PENDING').length > 0 && (
              <div>
                <div className="adm-sec-label"><span>Processed</span></div>
                <div style={{ background: 'var(--card-adm)', border: '1px solid var(--line-strong)', borderRadius: 14, overflow: 'hidden' }}>
                  {deposits.filter(d => d.status !== 'PENDING').slice(0, 20).map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line-strong)' }}>
                      <div className={`adm-avatar${d.status === 'COMPLETED' ? ' green' : ''}`} style={{ width: 32, height: 32, fontSize: '0.6rem' }}>
                        {d.status === 'COMPLETED' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)' }}>{d.user?.name}</p>
                        <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)' }}>{new Date(d.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)' }}>${d.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        <span className={`adm-status ${d.status === 'COMPLETED' ? 'ok' : 'bad'}`}>{d.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
