import { useState, useEffect, useCallback } from 'react';
import { Loader2, ShieldCheck, CheckCircle2, XCircle, X } from 'lucide-react';
import './AdminDashboard.css';

interface KYCSubmission {
  id: string;
  userId: string;
  status: string;
  documentType: string;
  frontUrl?: string | null;
  backUrl?: string | null;
  selfieUrl?: string | null;
  notes?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  user: { name?: string | null; email?: string | null };
}

function KYCActions({ submission, onDone }: { submission: KYCSubmission; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [loading, setL] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const act = async (action: 'APPROVED' | 'REJECTED') => {
    setL(action); setError('');
    const res = await fetch(`/api/admin/kyc/${submission.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, notes: note || undefined }),
    });
    setL(null);
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return; }
    setDone(true); onDone();
  };

  if (done) return <p className="adm-done-ok">✓ Reviewed</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {submission.frontUrl && (
          <div className="kyc-img-wrap" onClick={() => setPreview(submission.frontUrl!)}>
            <img src={submission.frontUrl} alt="Front" className="kyc-thumb" />
            <span className="kyc-img-label">Front</span>
          </div>
        )}
        {submission.backUrl && (
          <div className="kyc-img-wrap" onClick={() => setPreview(submission.backUrl!)}>
            <img src={submission.backUrl} alt="Back" className="kyc-thumb" />
            <span className="kyc-img-label">Back</span>
          </div>
        )}
        {submission.selfieUrl && (
          <div className="kyc-img-wrap" onClick={() => setPreview(submission.selfieUrl!)}>
            <img src={submission.selfieUrl} alt="Selfie" className="kyc-thumb" />
            <span className="kyc-img-label">Selfie</span>
          </div>
        )}
      </div>

      {(submission.status === 'APPROVED' || submission.status === 'REJECTED') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: submission.status === 'APPROVED' ? 'var(--green-l)' : 'var(--red-l)', border: `1px solid ${submission.status === 'APPROVED' ? 'var(--green)' : 'var(--red)'}` }}>
          {submission.status === 'APPROVED'
            ? <CheckCircle2 size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
            : <XCircle size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />}
          <span style={{ fontSize: '0.7rem', color: submission.status === 'APPROVED' ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--mono)' }}>
            {submission.status === 'APPROVED' ? 'Approved' : `Rejected${submission.notes ? ` — ${submission.notes}` : ''}`}
          </span>
        </div>
      )}

      {submission.status === 'PENDING' && (
        <div className="adm-action-wrap" style={{ paddingTop: 0, borderTop: 'none', marginTop: 0 }}>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Rejection reason (required if rejecting)" className="adm-note-input" />
          {error && <p className="adm-err">{error}</p>}
          <div className="adm-action-btns">
            <button onClick={() => act('APPROVED')} disabled={!!loading} className="adm-btn-approve">
              {loading === 'APPROVED' ? <Loader2 className="adm-spin" size={14} /> : <ShieldCheck size={14} />} Approve
            </button>
            <button onClick={() => act('REJECTED')} disabled={!!loading || !note.trim()} className="adm-btn-reject">
              {loading === 'REJECTED' ? <Loader2 className="adm-spin" size={14} /> : <XCircle size={14} />} Reject
            </button>
          </div>
        </div>
      )}

      {preview && (
        <>
          <div className="adm-overlay" onClick={() => setPreview(null)} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ position: 'relative', maxWidth: 600, width: '100%' }}>
              <img src={preview} alt="Document" style={{ width: '100%', borderRadius: 14, maxHeight: '80vh', objectFit: 'contain' }} />
              <button onClick={() => setPreview(null)} style={{ position: 'absolute', top: -12, right: -12, width: 32, height: 32, borderRadius: '50%', background: 'var(--card-adm)', border: '1px solid var(--line-strong)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminKycPage() {
  const [kycList, setKycList] = useState<KYCSubmission[]>([]);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [loading, setLoading] = useState(true);

  const fetchKyc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/kyc', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setKycList(d.submissions ?? []); }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchKyc(); }, [fetchKyc]);

  const filtered = kycList.filter(k => k.status === filter);
  const pendingCount = kycList.filter(k => k.status === 'PENDING').length;

  return (
    <div className="adm">
      <div className="adm-hdr">
        <div>
          <p className="adm-brand">Apex · Markets</p>
          <h1 className="adm-title">KYC Review</h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>{pendingCount} pending review</p>
          <div className="adm-filter-toggle">
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
              <button key={s} className={`adm-filter-btn${filter === s ? ` active-${s.toLowerCase()}` : ''}`} onClick={() => setFilter(s)}>
                {s === 'PENDING' ? 'Pending' : s === 'APPROVED' ? 'Approved' : 'Rejected'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="adm-empty"><Loader2 size={18} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty">
            <ShieldCheck size={28} style={{ opacity: 0.25 }} />
            <p>No {filter.toLowerCase()} submissions</p>
          </div>
        ) : filtered.map(k => (
          <div key={k.id} className="adm-card">
            <div className="adm-card-stripe" style={{
              background: k.status === 'PENDING' ? 'var(--gold)' : k.status === 'APPROVED' ? 'var(--green)' : 'var(--red)'
            }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="adm-avatar">{(k.user?.name || k.user?.email || '?')[0].toUpperCase()}</div>
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)' }}>{k.user?.name || 'Unknown'}</p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)' }}>{k.user?.email}</p>
                  <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', marginTop: 2 }}>
                    {k.documentType === 'PASSPORT' ? 'Passport' : k.documentType === 'NATIONAL_ID' ? 'National ID' : "Driver's License"}
                    {' · '}
                    {new Date(k.submittedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <span className={`adm-status ${k.status === 'PENDING' ? 'pending' : k.status === 'APPROVED' ? 'ok' : 'bad'}`}>{k.status}</span>
            </div>
            <KYCActions submission={k} onDone={fetchKyc} />
          </div>
        ))}
      </div>
    </div>
  );
}
