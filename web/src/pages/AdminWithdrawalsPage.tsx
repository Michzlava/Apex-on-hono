import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, ShieldAlert, Clock, CheckCircle, XCircle,
  InboxIcon, ArrowUpToLine,
} from 'lucide-react';
import './AdminDashboard.css';

interface Withdrawal {
  id: string;
  amount: number;
  currency: string;
  status: string;
  note?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  user: { name?: string; email?: string };
}

function parseWithdrawalNote(note?: string): { userNote: string | null; details: Record<string, string> } {
  if (!note) return { userNote: null, details: {} };
  const parts = note.split(' — ');
  const detailsStr = parts.length > 1 ? parts[1] : parts[0];
  const userNote   = parts.length > 1 ? parts[0] : null;
  const details: Record<string, string> = {};
  detailsStr.split(' | ').forEach(pair => {
    const idx = pair.indexOf(': ');
    if (idx !== -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 2).trim();
      if (key && val) details[key] = val;
    }
  });
  return { userNote, details };
}

function DetailRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: '0.55rem', fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)', minWidth: 72, paddingTop: 1, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: mono ? '0.65rem' : '0.72rem', fontFamily: mono ? 'var(--mono)' : 'var(--sans)', color: 'var(--ink)', wordBreak: 'break-all', lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

function WithdrawalDetails({ note }: { note?: string }) {
  const { userNote, details } = parseWithdrawalNote(note);
  const method = details['Coin'] ? 'crypto' : details['Account Name'] ? 'bank' : details['Cardholder Name'] ? 'card' : null;
  if (!Object.keys(details).length && !userNote) return null;
  return (
    <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--line-strong)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {method && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--mono)', padding: '2px 8px', borderRadius: 20, background: method === 'crypto' ? 'rgba(247,147,26,0.12)' : 'rgba(99,102,241,0.12)', color: method === 'crypto' ? '#f7931a' : 'var(--accent)' }}>
            {method === 'crypto' ? '₿ Crypto' : method === 'bank' ? '🏦 Bank' : '💳 Card'}
          </span>
        </div>
      )}
      {details['Coin'] && (<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><DetailRow label="Coin" value={details['Coin']} /><DetailRow label="Network" value={details['Network']} /><DetailRow label="Wallet" value={details['Wallet Address']} mono /></div>)}
      {details['Account Name'] && (<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><DetailRow label="Account Name" value={details['Account Name']} /><DetailRow label="Bank" value={details['Bank Name']} /><DetailRow label="Account No." value={details['Account Number']} mono /><DetailRow label="Routing" value={details['Routing / Sort Code']} mono /></div>)}
      {details['Cardholder Name'] && (<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><DetailRow label="Cardholder" value={details['Cardholder Name']} /><DetailRow label="Card" value={`•••• ${details['Card Number (last 4)']}`} mono /><DetailRow label="Expiry" value={details['Expiry']} mono /></div>)}
      {userNote && (<p style={{ fontSize: '0.65rem', color: 'var(--ink-dim)', fontStyle: 'italic', paddingTop: 4, borderTop: '1px solid var(--line)' }}>"{userNote}"</p>)}
    </div>
  );
}

function WithdrawalActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [loading, setL] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const act = async (action: 'APPROVED' | 'REJECTED') => {
    setL(action); setError('');
    const res = await fetch(`/api/admin/withdrawals/${id}`, {
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
        <button onClick={() => act('APPROVED')} disabled={!!loading} className="adm-btn-approve">
          {loading === 'APPROVED' ? <Loader2 className="adm-spin" size={14} /> : <CheckCircle size={14} />} Approve
        </button>
        <button onClick={() => act('REJECTED')} disabled={!!loading} className="adm-btn-reject">
          {loading === 'REJECTED' ? <Loader2 className="adm-spin" size={14} /> : <XCircle size={14} />} Reject
        </button>
      </div>
    </div>
  );
}

export default function AdminWithdrawalsPage() {
  const [pendingV, setPendingV] = useState<Withdrawal[]>([]);
  const [pending, setPending] = useState<Withdrawal[]>([]);
  const [processed, setProcessed] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/withdrawals', { credentials: 'include' });
      if (res.ok) {
        const all: Withdrawal[] = (await res.json()).withdrawals ?? [];
        setPendingV(all.filter(w => w.status === 'PENDING_VERIFICATION'));
        setPending(all.filter(w => w.status === 'PENDING'));
        setProcessed(all.filter(w => w.status === 'APPROVED' || w.status === 'REJECTED'));
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  return (
    <div className="adm">
      <div className="adm-hdr">
        <div>
          <p className="adm-brand">Apex · Markets</p>
          <h1 className="adm-title">Withdrawals</h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pendingV.length > 0 && (
          <div>
            <div className="adm-sec-label">
              <ShieldAlert size={13} style={{ color: 'var(--red)' }} />
              <span>Awaiting Verification</span>
              <span className="adm-status bad">{pendingV.length}</span>
            </div>
            {pendingV.map(w => (
              <div key={w.id} className="adm-card">
                <div className="adm-card-stripe" style={{ background: 'var(--red)' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="adm-avatar">{(w.user?.name || '?')[0].toUpperCase()}</div>
                    <div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)' }}>{w.user?.name || 'Unknown'}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)' }}>{w.user?.email}</p>
                      <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', marginTop: 2 }}>{new Date(w.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>${w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <WithdrawalDetails note={w.note} />
                {w.adminNote && <p style={{ marginTop: 8, fontSize: '0.65rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>Admin note: "{w.adminNote}"</p>}
                <WithdrawalActions id={w.id} onDone={fetchWithdrawals} />
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="adm-sec-label">
            <Clock size={13} style={{ color: 'var(--gold)' }} />
            <span>Pending</span>
            {pending.length > 0 && <span className="adm-status pending">{pending.length}</span>}
          </div>
          {loading ? (
            <div className="adm-empty"><Loader2 size={18} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>
          ) : pending.length === 0 ? (
            <div className="adm-empty"><InboxIcon size={24} style={{ opacity: 0.25 }} /><p>No pending withdrawals</p></div>
          ) : pending.map(w => (
            <div key={w.id} className="adm-card">
              <div className="adm-card-stripe" style={{ background: 'var(--gold)' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="adm-avatar">{(w.user?.name || '?')[0].toUpperCase()}</div>
                  <div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)' }}>{w.user?.name || 'Unknown'}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)' }}>{w.user?.email}</p>
                  </div>
                </div>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>${w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <WithdrawalDetails note={w.note} />
              <WithdrawalActions id={w.id} onDone={fetchWithdrawals} />
            </div>
          ))}
        </div>

        {processed.length > 0 && (
          <div>
            <div className="adm-sec-label"><span>Recently Processed</span></div>
            <div style={{ background: 'var(--card-adm)', border: '1px solid var(--line-strong)', borderRadius: 14, overflow: 'hidden' }}>
              {processed.slice(0, 20).map(w => (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--line-strong)' }}>
                  <div className="adm-avatar" style={{ width: 32, height: 32, fontSize: '0.6rem', background: w.status === 'APPROVED' ? 'var(--green)' : 'var(--red)' }}>
                    {w.status === 'APPROVED' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)' }}>{w.user?.name}</p>
                    <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)' }}>{new Date(w.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    {w.adminNote && <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>"{w.adminNote}"</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)' }}>${w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    <span className={`adm-status ${w.status === 'APPROVED' ? 'ok' : 'bad'}`}>{w.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
