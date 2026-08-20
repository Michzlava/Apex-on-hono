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
    } catch { setTixErr('Network error'); }
    finally { if (!silent) setLoadingTix(false); }
  }, [statusFilter]);

  const fetchTicketDetail = useCallback(async (id: string, silent = false) => {
    if (!silent) setDL(true);
    setDetailErr('');
    try {
      const res  = await fetch(`/api/admin/support/tickets/${id}`, { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setDetailErr(data.error || 'Failed'); return; }
      const t = data?.ticket as Ticket | undefined;
      if (!t) { setDetailErr('Not found'); return; }
      setTickets(prev => prev.map(x => x.id === t.id ? t : x));
    } catch { setDetailErr('Network error'); }
    finally { if (!silent) setDL(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/users', { cache: 'no-store', credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data.map((u: any) => ({
          ...u,
          name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null,
        })));
      }
    } catch {} finally { setLUsers(false); }
  }, []);

  const fetchDeposits = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deposits', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setDeposits(d.deposits ?? []); }
    } catch {} finally { setLDep(false); }
  }, []);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/withdrawals', { credentials: 'include' });
      if (res.ok) {
        const all: Withdrawal[] = (await res.json()).withdrawals ?? [];
        setPendingV(all.filter(w => w.status === 'PENDING_VERIFICATION'));
        setPending(all.filter(w => w.status === 'PENDING'));
        setProcessed(all.filter(w => w.status === 'APPROVED' || w.status === 'REJECTED'));
      }
    } catch {} finally { setLWd(false); }
  }, []);

  const fetchKyc = useCallback(async () => {
    setLoadingKyc(true);
    try {
      const res = await fetch('/api/admin/kyc', { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setKycList(d.submissions ?? []); }
    } catch {} finally { setLoadingKyc(false); }
  }, []);

  const fetchMethods = useCallback(async () => {
    setLM(true);
    try {
      const res = await fetch('/api/admin/deposit-methods/manage', { credentials: 'include' });
      if (res.ok) setMethods(await res.json());
    } catch {} finally { setLM(false); }
  }, []);

  // ── Effects ──
  useEffect(() => { fetchUsers(); fetchDeposits(); fetchWithdrawals(); fetchMethods(); fetchKyc(); }, []);
  useEffect(() => { fetchTickets(statusFilter); }, [statusFilter]);
  useEffect(() => {
    const i = setInterval(() => fetchTickets(statusFilter, true), 10_000);
    return () => clearInterval(i);
  }, [fetchTickets, statusFilter]);
  useEffect(() => {
    if (!selectedId) return;
    const i = setInterval(() => fetchTicketDetail(selectedId, true), 5_000);
    return () => clearInterval(i);
  }, [fetchTicketDetail, selectedId]);
  useEffect(() => {
    const msgs = selectedTicket?.messages ?? [];
    if (msgs.length > prevMsgCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCount.current = msgs.length;
  }, [selectedTicket?.messages]);
  useEffect(() => { prevMsgCount.current = 0; }, [selectedId]);

  // ── Support handlers ──
  const handleSelect = (id: string) => { setSelectedId(id); fetchTicketDetail(id); };
  const handleBack   = () => setSelectedId(null);
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReply(e.target.value);
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }
  };
  const handleReply = async () => {
    if (!selectedTicket || !reply.trim() || replying) return;
    setReplying(true); setDetailErr('');
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ body: reply }),
      });
      if (!res.ok) { setDetailErr((await res.json().catch(() => ({}))).error || 'Failed'); return; }
      setReply('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      await fetchTicketDetail(selectedTicket.id);
      await fetchTickets(statusFilter);
    } catch { setDetailErr('Network error'); }
    finally { setReplying(false); }
  };
  const handleStatus = async (next: 'OPEN' | 'CLOSED') => {
    if (!selectedTicket) return;
    await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ status: next }),
    });
    await fetchTicketDetail(selectedTicket.id);
    await fetchTickets(statusFilter);
  };

  // ── Settings handlers ──
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };
  const openNew   = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit  = (m: DepositMethod) => {
    setEditId(m.id);
    setForm({ label: m.label, icon: m.icon, address: m.address, network: m.network ?? '', note: m.note ?? '', isActive: m.isActive, sortOrder: m.sortOrder });
    setShowForm(true);
  };
  const f = (k: keyof FormState, v: string | boolean | number) => setForm(p => ({ ...p, [k]: v }));

  const saveMethods = async () => {
    if (!form.label.trim() || !form.address.trim()) { showToast('Label and address required', false); return; }
    setSaving(true);
    try {
      const body = { ...form, network: form.network || null, note: form.note || null, ...(editId ? { id: editId } : {}) };
      const res  = await fetch('/api/admin/deposit-methods/manage', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) { showToast(editId ? 'Method updated' : 'Method created'); setShowForm(false); fetchMethods(); }
      else showToast((await res.json()).error ?? 'Failed', false);
    } finally { setSaving(false); }
  };

  const toggleActive = async (m: DepositMethod) => {
    await fetch('/api/admin/deposit-methods/manage', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ id: m.id, isActive: !m.isActive }),
    });
    fetchMethods();
  };

  const removeMethod = async (id: string) => {
    if (!confirm('Delete this deposit method?')) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/deposit-methods/manage?id=${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showToast('Deleted'); fetchMethods(); } else showToast('Failed', false);
    setDeleting(null);
  };

  const grouped    = groupByDate(selectedTicket?.messages ?? []);
  const filteredKyc = kycList.filter(k => k.status === kycFilter);

  const tabs = [
    { id: 'chat',        label: 'Support',     icon: MessageSquare, badge: unread,             color: '#e85c0d' },
    { id: 'users',       label: 'Users',       icon: Users,         badge: users.length,       color: '#6b5ce7' },
    { id: 'deposits',    label: 'Deposits',    icon: TrendingUp,    badge: pendingDeps.length, color: '#2e7d4f' },
    { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpToLine, badge: actionableWd,       color: '#b85c0d' },
    { id: 'kyc',         label: 'KYC',         icon: ShieldCheck,   badge: pendingKyc,         color: '#0369a1' },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, badge: 0, color: '#7c3aed' },
    { id: 'settings',    label: 'Settings',    icon: Settings,      badge: 0,                  color: '#6b6457' },
  ];

  return (
    <>
      <div className="adm">
        <div className="adm-hdr">
          <div>
            <p className="adm-brand">Apex · Markets</p>
            <h1 className="adm-title">Admin Panel</h1>
          </div>
          {unread > 0 && (
            <div className="adm-bell" onClick={() => setTab('chat')}>
              <Bell size={16} color="var(--ink-dim)" />
              <span className="adm-bell-badge">{unread}</span>
            </div>
          )}
        </div>

        <div className="adm-tabs">
          {tabs.map(({ id, label, icon: Icon, badge, color }) => (
            <button key={id} className={`adm-tab${tab === id ? ' active' : ''}`} style={tab === id ? { background: color, borderColor: color } : {}} onClick={() => setTab(id as Tab)}>
              {badge > 0 && <span className="adm-tab-badge">{badge}</span>}
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        {/* ══ Support ══ */}
        {tab === 'chat' && (
          <div className="adm-chat-grid">
            <div className={`adm-ticket-list${selectedId ? ' has-selection' : ''}`}>
              <div className="adm-ticket-head">
                <span className="adm-ticket-head-title">Conversations</span>
                <div className="adm-filter-toggle">
                  {(['OPEN', 'CLOSED'] as const).map(s => (
                    <button key={s} className={`adm-filter-btn${statusFilter === s ? (s === 'OPEN' ? ' active-open' : ' active-closed') : ''}`} onClick={() => { setFilter(s); setSelectedId(null); }}>
                      {s === 'OPEN' ? 'Open' : 'Closed'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="adm-ticket-scroll">
                {tixErr && <p style={{ padding: '12px 16px', fontSize: '0.65rem', color: 'var(--red)' }}>{tixErr}</p>}
                {loadingTix ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: 8, color: 'var(--ink-faint)' }}><Loader2 size={16} className="adm-spin" /> Loading…</div>
                ) : tickets.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: 8, color: 'var(--ink-faint)' }}><MessageCircle size={24} style={{ opacity: 0.3 }} /><p style={{ fontSize: '0.72rem' }}>No {statusFilter.toLowerCase()} tickets</p></div>
                ) : tickets.map(t => {
                  const last = t.messages?.[t.messages.length - 1];
                  const isSelected = selectedId === t.id;
                  return (
                    <button key={t.id} className={`adm-ticket-item${isSelected ? ' sel' : ''}`} onClick={() => handleSelect(t.id)}>
                      <div className="adm-avatar" style={{ width: 34, height: 34, fontSize: '0.62rem', flexShrink: 0 }}>{initials(t.user?.name, t.user?.email)}</div>
                      <div className="adm-ticket-item-body">
                        <div className="adm-ticket-item-row1">
                          <p style={{ fontSize: '0.73rem', fontWeight: 700, color: isSelected ? '#38bdf8' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.user?.name || t.user?.email || 'Unknown'}</p>
                          <span style={{ fontSize: '0.55rem', color: 'var(--ink-faint)', flexShrink: 0, marginLeft: 6 }}>{fmtTime(t.updatedAt)}</span>
                        </div>
                        <p style={{ fontSize: '0.63rem', color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</p>
                        {last && <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.sender === 'ADMIN' ? 'You: ' : ''}{last.body}</p>}
                      </div>
                      <Circle size={8} style={{ fill: t.status === 'OPEN' ? 'var(--accent)' : 'var(--line-strong)', color: t.status === 'OPEN' ? 'var(--accent)' : 'var(--line-strong)', flexShrink: 0, marginTop: 4 }} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`adm-thread${!selectedTicket ? ' no-selection' : ''}`}>
              {!selectedTicket ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px', color: 'var(--ink-faint)' }}>
                  <MessageCircle size={28} style={{ opacity: 0.25 }} />
                  <p style={{ fontSize: '0.75rem', fontWeight: 500 }}>Select a conversation</p>
                </div>
              ) : (
                <>
                  <div className="adm-thread-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button className="adm-back-btn" onClick={handleBack}><ChevronLeft size={16} /></button>
                      <div className="adm-avatar" style={{ width: 34, height: 34, fontSize: '0.62rem' }}>{initials(selectedTicket.user?.name, selectedTicket.user?.email)}</div>
                      <div>
                        <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)' }}>{selectedTicket.user?.name || selectedTicket.user?.email || 'Unknown'}</p>
                        <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)' }}>{selectedTicket.user?.email}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`adm-status ${selectedTicket.status === 'OPEN' ? 'ok' : 'grey'}`}>{selectedTicket.status === 'OPEN' ? '● Open' : 'Closed'}</span>
                      {selectedTicket.status === 'OPEN'
                        ? <button className="adm-status-btn" onClick={() => handleStatus('CLOSED')}><CheckCircle2 size={12} /> Close</button>
                        : <button className="adm-status-btn" onClick={() => handleStatus('OPEN')}><RefreshCw size={12} /> Reopen</button>}
                    </div>
                  </div>
                  <div className="adm-thread-msgs">
                    {detailLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}><Loader2 size={16} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>}
                    {detailErr && <p style={{ fontSize: '0.65rem', color: 'var(--red)', textAlign: 'center' }}>{detailErr}</p>}
                    {grouped.map(({ date, messages: dms }) => (
                      <div key={date}>
                        <div className="adm-divider"><div className="adm-divider-line" /><span className="adm-divider-label">{fmtDate(dms[0].createdAt)}</span><div className="adm-divider-line" /></div>
                        {dms.map(msg => {
                          const isAdm = msg.sender === 'ADMIN';
                          return (
                            <div key={msg.id} className={`adm-msg-row${isAdm ? ' admin' : ''}`}>
                              {!isAdm && <div className="adm-avatar" style={{ width: 26, height: 26, fontSize: '0.52rem', flexShrink: 0 }}>{initials(selectedTicket.user?.name, selectedTicket.user?.email)}</div>}
                              <div className={`adm-msg-col ${isAdm ? 'admin' : 'user'}`}>
                                <div className={`adm-bubble ${isAdm ? 'admin' : 'user'}`}>{msg.body}</div>
                                <span className="adm-msg-time">{isAdm ? 'You · ' : ''}{fmtTime(msg.createdAt)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                  <div className="adm-thread-input">
                    <textarea ref={textareaRef} value={reply} onChange={handleInputChange} onKeyDown={handleKeyDown} rows={1} placeholder="Reply… (Enter to send)" className="adm-textarea" />
                    <button className="adm-send-btn" disabled={!reply.trim() || replying} onClick={handleReply}>
                      {replying ? <Loader2 size={14} className="adm-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ Users ══ */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>{users.length} total users</p>
              <div className="adm-search-wrap" style={{ width: 200 }}><Search size={13} /><input className="adm-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
            </div>
            <div style={{ background: 'var(--card-adm)', border: '1px solid var(--line-strong)', borderRadius: 14, overflow: 'hidden' }}>
              {loadingUsers ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32, gap: 8, color: 'var(--ink-faint)' }}><Loader2 size={16} className="adm-spin" /> Loading…</div>
              ) : users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                <p style={{ padding: '32px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--ink-faint)' }}>No users found</p>
              ) : users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())).map((u: any) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--line-strong)' }}>
                  <div className="adm-avatar">{u.name ? u.name[0].toUpperCase() : 'U'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Unnamed'}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink)' }}>${(u.portfolioBalance || 0).toLocaleString()}</p>
                    <Link to={`/dashboard/admin/users/${u.id}`} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', background: 'var(--surface)', color: 'var(--ink-dim)', borderRadius: 6, fontSize: '0.6rem', fontWeight: 600, textDecoration: 'none', border: '1px solid var(--line-strong)' }}><Edit size={10} /> Edit</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Deposits ══ */}
        {tab === 'deposits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {loadingDep ? (
              <div className="adm-empty"><Loader2 size={18} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>
            ) : pendingDeps.length === 0 && deposits.filter(d => d.status !== 'PENDING').length === 0 ? (
              <div className="adm-empty"><TrendingUp size={28} style={{ opacity: 0.25 }} /><p>No deposit submissions yet</p></div>
            ) : (
              <>
                {pendingDeps.length > 0 && (
                  <div>
                    <div className="adm-sec-label"><Clock size={13} style={{ color: 'var(--gold)' }} /><span>Awaiting Confirmation</span><span className="adm-status pending">{pendingDeps.length}</span></div>
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
                          <div className={`adm-avatar${d.status === 'COMPLETED' ? ' green' : ''}`} style={{ width: 32, height: 32, fontSize: '0.6rem' }}>{d.status === 'COMPLETED' ? <CheckCircle size={14} /> : <XCircle size={14} />}</div>
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
        )}

        {/* ══ Withdrawals ══ */}
        {tab === 'withdrawals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pendingV.length > 0 && (
              <div>
                <div className="adm-sec-label"><ShieldAlert size={13} style={{ color: 'var(--red)' }} /><span>Awaiting Verification</span><span className="adm-status bad">{pendingV.length}</span></div>
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
              <div className="adm-sec-label"><Clock size={13} style={{ color: 'var(--gold)' }} /><span>Pending</span>{pending.length > 0 && <span className="adm-status pending">{pending.length}</span>}</div>
              {loadingWd ? (
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
                      <div className="adm-avatar" style={{ width: 32, height: 32, fontSize: '0.6rem', background: w.status === 'APPROVED' ? 'var(--green)' : 'var(--red)' }}>{w.status === 'APPROVED' ? <CheckCircle size={14} /> : <XCircle size={14} />}</div>
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
        )}

        {/* ══ KYC ══ */}
        {tab === 'kyc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>
                {kycList.filter(k => k.status === 'PENDING').length} pending review
              </p>
              <div className="adm-filter-toggle">
                {(['PENDING', 'APPROVED', 'REJECTED'] as const).map(s => (
                  <button
                    key={s}
                    className={`adm-filter-btn${kycFilter === s ? ` active-${s.toLowerCase()}` : ''}`}
                    onClick={() => setKycFilter(s)}
                  >
                    {s === 'PENDING' ? 'Pending' : s === 'APPROVED' ? 'Approved' : 'Rejected'}
                  </button>
                ))}
              </div>
            </div>

            {loadingKyc ? (
              <div className="adm-empty"><Loader2 size={18} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>
            ) : filteredKyc.length === 0 ? (
              <div className="adm-empty">
                <ShieldCheck size={28} style={{ opacity: 0.25 }} />
                <p>No {kycFilter.toLowerCase()} submissions</p>
              </div>
            ) : filteredKyc.map(k => (
              <div key={k.id} className="adm-card">
                <div className="adm-card-stripe" style={{
                  background: k.status === 'PENDING' ? 'var(--gold)'
                    : k.status === 'APPROVED' ? 'var(--green)'
                    : 'var(--red)'
                }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="adm-avatar">{(k.user?.name || k.user?.email || '?')[0].toUpperCase()}</div>
                    <div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)' }}>{k.user?.name || 'Unknown'}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)' }}>{k.user?.email}</p>
                      <p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', marginTop: 2 }}>
                        {k.documentType === 'PASSPORT' ? 'Passport'
                          : k.documentType === 'NATIONAL_ID' ? 'National ID'
                          : "Driver's License"}
                        {' · '}
                        {new Date(k.submittedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className={`adm-status ${k.status === 'PENDING' ? 'pending' : k.status === 'APPROVED' ? 'ok' : 'bad'}`}>
                    {k.status}
                  </span>
                </div>
                <KYCActions submission={k} onDone={fetchKyc} />
              </div>
            ))}
          </div>
        )}

        {/* ══ Subscriptions ══ */}
        {tab === 'subscriptions' && (
          <Link to="/dashboard/admin/subscriptions" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', background: 'var(--accent)', color: 'var(--bg-adm)', border: 'none', borderRadius: 10, font: '600 0.78rem var(--sans)', cursor: 'pointer', transition: 'opacity 0.15s' }} onMouseEnter={e => e.currentTarget.style.opacity = '0.88'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              <CreditCard size={16} />
              Go to Subscriptions
            </button>
          </Link>
        )}

        {/* ══ Settings ══ */}
        {tab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ink)' }}>Deposit Methods</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', marginTop: 2 }}>Addresses shown to users on the deposit sheet</p>
              </div>
              <button className="adm-add-btn" onClick={openNew}><Plus size={12} /> Add Method</button>
            </div>
            {loadingM ? (
              <div className="adm-empty"><Loader2 size={18} className="adm-spin" style={{ color: 'var(--ink-faint)' }} /></div>
            ) : methods.length === 0 ? (
              <div className="adm-empty" style={{ border: '1.5px dashed var(--line-strong)' }}><Settings size={24} style={{ opacity: 0.2 }} /><p>No deposit methods yet — add one above</p></div>
            ) : methods.map(m => (
              <div key={m.id} className="adm-method-card">
                <div className="adm-card-stripe" style={{ background: m.isActive ? 'var(--accent)' : 'var(--line-strong)' }} />
                <div className="adm-method-ico">{m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)' }}>{m.label}</p>
                    {m.network && <span className="adm-status grey" style={{ fontSize: '0.48rem' }}>{m.network}</span>}
                    <span className={`adm-status ${m.isActive ? 'ok' : 'grey'}`} style={{ fontSize: '0.48rem' }}>{m.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="adm-method-addr">{m.address}</div>
                  {m.note && <p style={{ marginTop: 5, fontSize: '0.6rem', color: 'var(--gold)', background: 'var(--gold-l)', padding: '4px 8px', borderRadius: 6 }}>⚠️ {m.note}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <label className="adm-toggle" title={m.isActive ? 'Deactivate' : 'Activate'}><input type="checkbox" checked={m.isActive} onChange={() => toggleActive(m)} /><span className="adm-toggle-track" /></label>
                  <button className="adm-icon-btn" onClick={() => openEdit(m)}><Edit size={13} /></button>
                  <button className="adm-icon-btn danger" onClick={() => removeMethod(m.id)} disabled={deleting === m.id}>{deleting === m.id ? <Loader2 size={13} className="adm-spin" /> : <Trash2 size={13} />}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      {showForm && (
        <>
          <div className="adm-overlay" onClick={() => setShowForm(false)} />
          <div className="adm-drawer">
            <div className="adm-drawer-handle" />
            <p className="adm-drawer-title">{editId ? 'Edit Method' : 'New Deposit Method'}</p>
            <div className="adm-field">
              <label className="adm-field-label">Icon</label>
              <div className="adm-icon-row">
                {ICON_PRESETS.map(ic => (<div key={ic} className={`adm-icon-pick${form.icon === ic ? ' sel' : ''}`} onClick={() => f('icon', ic)}>{ic}</div>))}
                <input className="adm-input" style={{ width: 72, padding: '6px 10px', textAlign: 'center' }} value={form.icon} maxLength={4} onChange={e => f('icon', e.target.value)} placeholder="Custom" />
              </div>
            </div>
            <div className="adm-field"><label className="adm-field-label">Label *</label><input className="adm-input" value={form.label} onChange={e => f('label', e.target.value)} placeholder="e.g. Bitcoin (BTC)" /></div>
            <div className="adm-field"><label className="adm-field-label">Address / Account Details *</label><textarea className="adm-input" value={form.address} onChange={e => f('address', e.target.value)} placeholder="Wallet address, IBAN, or payment details" /></div>
            <div className="adm-row-2">
              <div className="adm-field"><label className="adm-field-label">Network (optional)</label><input className="adm-input" value={form.network} onChange={e => f('network', e.target.value)} placeholder="e.g. ERC-20" /></div>
              <div className="adm-field"><label className="adm-field-label">Display Order</label><input className="adm-input" type="number" value={form.sortOrder} onChange={e => f('sortOrder', Number(e.target.value))} min={0} /></div>
            </div>
            <div className="adm-field"><label className="adm-field-label">Warning Note (optional)</label><input className="adm-input" value={form.note} onChange={e => f('note', e.target.value)} placeholder="e.g. Min deposit $50" /></div>
            <div className="adm-field">
              <label className="adm-checkbox-row" onClick={() => f('isActive', !form.isActive)}>
                <input type="checkbox" checked={form.isActive} readOnly />
                <div><p style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--ink)' }}>Active</p><p style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', marginTop: 1 }}>Show this method to users on the deposit sheet</p></div>
              </label>
            </div>
            <div className="adm-drawer-footer">
              <button className="adm-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="adm-btn-save" disabled={saving} onClick={saveMethods}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Create Method'}</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className={`adm-toast ${toast.ok ? 'ok' : 'err'}`}>{toast.ok ? '✓' : '✕'} {toast.msg}</div>}
    </>
  );
}
