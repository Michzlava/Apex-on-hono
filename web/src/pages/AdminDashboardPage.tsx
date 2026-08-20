import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, MessageSquare, Send, X, ChevronRight,
  CheckCircle, XCircle, ArrowUpToLine, Search,
  Edit, Loader2, Bell, ShieldAlert,
  Clock, KeyRound, InboxIcon, CheckCircle2,
  RefreshCw, Circle, MessageCircle, Settings,
  TrendingUp, Plus, Trash2, ToggleLeft, ToggleRight, ChevronLeft,
  ShieldCheck, Eye, FileText, Camera, CreditCard,
} from 'lucide-react';
import './AdminDashboard.css';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Subscription {
  id: string;
  userId: string;
  plan: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  startDate: string;
  renewalDate: string;
  amount: number;
  currency: string;
  user: { name?: string; email?: string };
}

interface Ticket {
  id: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  updatedAt: string;
  createdAt: string;
  user?: { id: string; email: string; name?: string | null };
  messages?: { id: string; sender: 'USER' | 'ADMIN'; body: string; createdAt: string }[];
}

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

interface DepositMethod {
  id: string;
  label: string;
  icon: string;
  address: string;
  network: string | null;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

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

type FormState = {
  label: string; icon: string; address: string;
  network: string; note: string; isActive: boolean; sortOrder: number;
};

const EMPTY_FORM: FormState = {
  label: '', icon: '₿', address: '', network: '', note: '', isActive: true, sortOrder: 0,
};
const ICON_PRESETS = ['₿', 'Ξ', '◎', '💳', '🏦', 'T', '$', '🔗'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function countUnread(tickets: Ticket[]) {
  let n = 0;
  for (const t of tickets) {
    if (t.status === 'CLOSED') continue;
    const msgs = t.messages ?? [];
    const lastAdmin = msgs.map(m => m.sender).lastIndexOf('ADMIN');
    n += msgs.filter((m, i) => m.sender === 'USER' && i > lastAdmin).length;
  }
  return n;
}

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(' '); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtDate(d: string) {
  const dt = new Date(d), today = new Date(), yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (dt.toDateString() === today.toDateString()) return 'Today';
  if (dt.toDateString() === yest.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
function groupByDate(msgs: NonNullable<Ticket['messages']>) {
  const g: { date: string; messages: typeof msgs }[] = [];
  msgs.forEach(m => {
    const d = new Date(m.createdAt).toDateString();
    const last = g[g.length - 1];
    if (last?.date === d) last.messages.push(m);
    else g.push({ date: d, messages: [m] });
  });
  return g;
}
function initials(name?: string | null, email?: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
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

function DetailRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: '0.55rem', fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)', minWidth: 72, paddingTop: 1, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: mono ? '0.65rem' : '0.72rem', fontFamily: mono ? 'var(--mono)' : 'var(--sans)', color: 'var(--ink)', wordBreak: 'break-all', lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

function WithdrawalActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote]   = useState('');
  const [loading, setL]   = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone]   = useState(false);
  const act = async (action: 'APPROVED' | 'REJECTED') => {
    setL(action); setError('');
    const res = await fetch(`/api/admin/withdrawals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action, adminNote: note || undefined }) });
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
        <button onClick={() => act('APPROVED')} disabled={!!loading} className="adm-btn-approve">{loading === 'APPROVED' ? <Loader2 className="adm-spin" size={14} /> : <CheckCircle size={14} />} Approve</button>
        <button onClick={() => act('REJECTED')} disabled={!!loading} className="adm-btn-reject">{loading === 'REJECTED' ? <Loader2 className="adm-spin" size={14} /> : <XCircle size={14} />} Reject</button>
      </div>
    </div>
  );
}

function DepositActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [note, setNote]   = useState('');
  const [loading, setL]   = useState<'COMPLETED' | 'REJECTED' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone]   = useState(false);
  const act = async (action: 'COMPLETED' | 'REJECTED') => {
    setL(action); setError('');
    const res = await fetch(`/api/admin/deposits/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ action, adminNote: note || undefined }) });
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
        <button onClick={() => act('COMPLETED')} disabled={!!loading} className="adm-btn-approve">{loading === 'COMPLETED' ? <Loader2 className="adm-spin" size={14} /> : <CheckCircle size={14} />} Confirm</button>
        <button onClick={() => act('REJECTED')} disabled={!!loading} className="adm-btn-reject">{loading === 'REJECTED' ? <Loader2 className="adm-spin" size={14} /> : <XCircle size={14} />} Reject</button>
      </div>
    </div>
  );
}

// ── KYC Actions Component ─────────────────────────────────────────────────────
function KYCActions({ submission, onDone }: { submission: KYCSubmission; onDone: () => void }) {
  const [note, setNote]   = useState('');
  const [loading, setL]   = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone]   = useState(false);
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

  const docLabel = submission.documentType === 'PASSPORT' ? 'Passport'
    : submission.documentType === 'NATIONAL_ID' ? 'National ID'
    : 'Driver\'s License';

  if (done) return <p className="adm-done-ok">✓ Reviewed</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Document images */}
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

      {/* Already reviewed */}
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

      {/* Actions — only for PENDING */}
      {submission.status === 'PENDING' && (
        <div className="adm-action-wrap" style={{ paddingTop: 0, borderTop: 'none', marginTop: 0 }}>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={300}
            placeholder="Rejection reason (required if rejecting)"
            className="adm-note-input"
          />
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

      {/* Image preview modal */}
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  type Tab = 'chat' | 'users' | 'deposits' | 'withdrawals' | 'kyc' | 'subscriptions' | 'settings';
  const [tab, setTab] = useState<Tab>('chat');

  // Support
  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setFilter]   = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [loadingTix, setLoadingTix] = useState(true);
  const [detailLoading, setDL]      = useState(false);
  const [tixErr, setTixErr]         = useState('');
  const [detailErr, setDetailErr]   = useState('');
  const [reply, setReply]           = useState('');
  const [replying, setReplying]     = useState(false);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const prevMsgCount = useRef<number>(0);

  // Users
  const [users, setUsers]         = useState<any[]>([]);
  const [search, setSearch]       = useState('');
  const [loadingUsers, setLUsers] = useState(true);

  // Deposits
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loadingDep, setLDep]   = useState(true);

  // Withdrawals
  const [pendingV, setPendingV]   = useState<Withdrawal[]>([]);
  const [pending, setPending]     = useState<Withdrawal[]>([]);
  const [processed, setProcessed] = useState<Withdrawal[]>([]);
  const [loadingWd, setLWd]       = useState(true);

  // KYC
  const [kycList, setKycList]       = useState<KYCSubmission[]>([]);
  const [kycFilter, setKycFilter]   = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [loadingKyc, setLoadingKyc] = useState(true);

  // Settings
  const [methods, setMethods]   = useState<DepositMethod[]>([]);
  const [loadingM, setLM]       = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const selectedTicket = useMemo(() => tickets.find(t => t.id === selectedId) ?? null, [tickets, selectedId]);
  const unread         = countUnread(tickets);
  const pendingDeps    = deposits.filter(d => d.status === 'PENDING');
  const actionableWd   = pendingV.length + pending.length;
  const pendingKyc     = kycList.filter(k => k.status === 'PENDING').length;

  // ── Fetchers ──
  const fetchTickets = useCallback(async (f = statusFilter, silent = false) => {
    if (!silent) setLoadingTix(true);
    setTixErr('');
    try {
      const res  = await fetch(`/api/admin/support/tickets?status=${f}`, { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setTixErr(data.error || 'Failed'); return; }
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
    } catch { setTixErr('Network error
