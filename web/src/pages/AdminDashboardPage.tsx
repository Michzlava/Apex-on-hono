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
      <style>{`
        .adm { max-width: 900px; margin: 0 auto; padding: 24px 16px 40px; font-family: var(--sans); color: var(--ink); background: var(--bg-adm); min-height: 100vh; }
        .adm-hdr { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; }
        .adm-brand { font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.18em; color: var(--accent); text-transform: uppercase; margin-bottom: 4px; }
        .adm-title { font-size: 1.4rem; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }
        .adm-bell { position: relative; width: 38px; height: 38px; border-radius: 50%; background: var(--card-adm); border: 1px solid var(--line-strong); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .adm-bell-badge { position: absolute; top: -3px; right: -3px; width: 18px; height: 18px; background: var(--accent); border-radius: 50%; color: var(--bg-adm); font-size: 0.52rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .adm-tabs { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 20px; }
        .adm-tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 14px 8px; border-radius: 14px; border: 1px solid var(--line-strong); background: var(--card-adm); font-family: var(--sans); font-size: 0.65rem; font-weight: 600; color: var(--ink-faint); cursor: pointer; transition: all 0.15s; }
        .adm-tab:hover { border-color: var(--accent); color: var(--ink-dim); }
        .adm-tab.active { color: #fff; border-color: transparent; }
        .adm-tab-badge { position: absolute; top: 8px; right: 8px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; font-size: 0.5rem; font-weight: 700; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.25); color: #fff; }
        .adm-tab:not(.active) .adm-tab-badge { background: var(--accent); color: var(--bg-adm); }
        .adm-card { background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; padding: 18px 20px; margin-bottom: 10px; position: relative; overflow: hidden; }
        .adm-card-stripe { position: absolute; top: 0; left: 0; bottom: 0; width: 3px; border-radius: 3px 0 0 3px; }
        .adm-action-wrap { display: flex; flex-direction: column; gap: 10px; padding-top: 14px; border-top: 1px solid var(--line-strong); margin-top: 14px; }
        .adm-note-input { width: 100%; padding: 9px 13px; border: 1.5px solid var(--line-strong); border-radius: 10px; background: var(--surface); font-family: var(--sans); font-size: 0.75rem; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .adm-note-input:focus { border-color: var(--accent); }
        .adm-note-input::placeholder { color: var(--ink-faint); }
        .adm-action-btns { display: flex; gap: 8px; }
        .adm-btn-approve { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px; border-radius: 10px; background: var(--green); color: var(--bg-adm); border: none; font-family: var(--sans); font-size: 0.72rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .adm-btn-approve:hover { opacity: 0.85; }
        .adm-btn-approve:disabled { opacity: 0.4; cursor: not-allowed; }
        .adm-btn-reject { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px; border-radius: 10px; background: transparent; color: var(--red); border: 1px solid var(--red); font-family: var(--sans); font-size: 0.72rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
        .adm-btn-reject:hover { background: var(--red-l); }
        .adm-btn-reject:disabled { opacity: 0.4; cursor: not-allowed; }
        .adm-done-ok { font-size: 0.72rem; font-weight: 600; color: var(--green); text-align: center; padding: 8px 0; }
        .adm-err { font-size: 0.65rem; color: var(--red); }
        .adm-spin { animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .adm-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; color: var(--bg-adm); font-size: 0.7rem; font-weight: 700; flex-shrink: 0; }
        .adm-avatar.green { background: var(--green); }
        .adm-status { font-family: var(--mono); font-size: 0.52rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; border-radius: 20px; display: inline-block; }
        .adm-status.pending { background: var(--gold-l); color: var(--gold); }
        .adm-status.ok      { background: var(--green-l); color: var(--green); }
        .adm-status.bad     { background: var(--red-l); color: var(--red); }
        .adm-status.grey    { background: var(--surface); color: var(--ink-faint); }
        .adm-sec-label { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .adm-sec-label span { font-size: 0.6rem; font-weight: 700; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.1em; }
        .adm-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; gap: 8px; background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; }
        .adm-empty p { font-size: 0.72rem; color: var(--ink-faint); font-weight: 300; }
        .adm-search-wrap { position: relative; }
        .adm-search-wrap svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--ink-faint); }
        .adm-search { width: 100%; padding: 8px 12px 8px 34px; border: 1.5px solid var(--line-strong); border-radius: 10px; background: var(--card-adm); font-family: var(--sans); font-size: 0.75rem; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .adm-search:focus { border-color: var(--accent); }
        .adm-chat-grid { display: grid; grid-template-columns: 280px 1fr; gap: 12px; min-height: 600px; }
        .adm-ticket-list { background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; }
        .adm-ticket-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--line-strong); flex-shrink: 0; }
        .adm-ticket-head-title { font-size: 0.75rem; font-weight: 700; color: var(--ink); }
        .adm-filter-toggle { display: flex; gap: 2px; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 8px; padding: 2px; }
        .adm-filter-btn { padding: 4px 10px; border-radius: 6px; border: none; background: transparent; font-family: var(--sans); font-size: 0.6rem; font-weight: 600; color: var(--ink-faint); cursor: pointer; transition: all 0.12s; }
        .adm-filter-btn.active-open     { background: var(--accent); color: var(--bg-adm); }
        .adm-filter-btn.active-closed   { background: var(--surface-hover); color: var(--ink-dim); }
        .adm-filter-btn.active-pending  { background: var(--gold); color: var(--bg-adm); }
        .adm-filter-btn.active-approved { background: var(--green); color: var(--bg-adm); }
        .adm-filter-btn.active-rejected { background: var(--red); color: white; }
        .adm-filter-btn.active-active   { background: var(--green); color: var(--bg-adm); }
        .adm-filter-btn.active-paused   { background: var(--gold); color: var(--bg-adm); }
        .adm-filter-btn.active-cancelled { background: var(--red); color: white; }
        .adm-filter-btn.active-expired  { background: var(--ink-faint); color: var(--bg-adm); }
        .adm-ticket-scroll { flex: 1; overflow-y: auto; background: var(--card-adm); }
        .adm-ticket-item { width: 100%; text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--line); background: transparent; border-left: 3px solid transparent; border-right: none; border-top: none; cursor: pointer; transition: background 0.12s, border-left-color 0.12s; display: flex; align-items: flex-start; gap: 10px; min-height: 68px; }
        .adm-ticket-item:hover { background: var(--surface); }
        .adm-ticket-item.sel { background: rgba(56, 189, 248, 0.12); border-left-color: #38bdf8; }
        .adm-ticket-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .adm-ticket-item-row1 { display: flex; justify-content: space-between; align-items: center; gap: 4px; }
        .adm-thread { background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; min-height: 600px; }
        .adm-thread-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line-strong); flex-shrink: 0; }
        .adm-thread-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
        .adm-thread-input { border-top: 1px solid var(--line-strong); padding: 12px 14px; display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0; }
        .adm-textarea { flex: 1; resize: none; background: var(--surface); border: 1.5px solid var(--line-strong); border-radius: 10px; padding: 9px 13px; font-family: var(--sans); font-size: 0.78rem; color: var(--ink); outline: none; transition: all 0.15s; min-height: 40px; max-height: 120px; }
        .adm-textarea:focus { border-color: var(--accent); background: var(--card-adm); }
        .adm-send-btn { width: 38px; height: 38px; border-radius: 10px; background: var(--accent); color: var(--bg-adm); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: opacity 0.15s; }
        .adm-send-btn:hover { opacity: 0.85; }
        .adm-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .adm-msg-row { display: flex; align-items: flex-end; gap: 6px; margin-bottom: 6px; }
        .adm-msg-row.admin { justify-content: flex-end; }
        .adm-msg-col { display: flex; flex-direction: column; max-width: 75%; }
        .adm-msg-col.admin { align-items: flex-end; }
        .adm-msg-col.user  { align-items: flex-start; }
        .adm-bubble { width: fit-content; max-width: 100%; padding: 9px 13px; border-radius: 14px; font-size: 0.78rem; line-height: 1.5; word-break: break-word; overflow-wrap: break-word; white-space: pre-wrap; }
        .adm-bubble.user  { background: var(--surface); border: 1px solid var(--line-strong); color: var(--ink); border-bottom-left-radius: 4px; }
        .adm-bubble.admin { background: var(--accent); color: var(--bg-adm); border-bottom-right-radius: 4px; }
        .adm-msg-time { font-size: 0.55rem; color: var(--ink-faint); margin-top: 3px; padding: 0 2px; }
        .adm-divider { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
        .adm-divider-line { flex: 1; height: 1px; background: var(--line-strong); }
        .adm-divider-label { font-size: 0.58rem; color: var(--ink-faint); font-weight: 500; }
        .adm-status-btn { display: flex; align-items: center; gap: 5px; font-size: 0.62rem; font-weight: 600; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--line-strong); background: transparent; color: var(--ink-faint); cursor: pointer; transition: all 0.15s; }
        .adm-status-btn:hover { border-color: var(--accent); color: var(--accent); }
        .adm-back-btn { display: none; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink-dim); cursor: pointer; flex-shrink: 0; transition: all 0.12s; }
        .adm-back-btn:hover { background: var(--surface-hover); color: var(--ink); }

        .kyc-img-wrap { position: relative; cursor: pointer; border-radius: 10px; overflow: hidden; border: 1px solid var(--line-strong); flex-shrink: 0; }
        .kyc-thumb { width: 100px; height: 70px; object-fit: cover; display: block; transition: opacity 0.15s; }
        .kyc-img-wrap:hover .kyc-thumb { opacity: 0.8; }
        .kyc-img-label { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); font-size: 0.52rem; font-family: var(--mono); color: white; padding: 3px 6px; text-align: center; }

        @media (max-width: 700px) {
          .adm-chat-grid { grid-template-columns: 1fr; }
          .adm-tabs { grid-template-columns: repeat(3, 1fr); }
          .adm-ticket-list.has-selection { display: none; }
          .adm-thread.no-selection { display: none; }
          .adm-back-btn { display: flex; }
        }

        .adm-method-card { background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; padding: 16px 18px; margin-bottom: 10px; display: flex; align-items: center; gap: 14px; position: relative; overflow: hidden; }
        .adm-method-ico { width: 42px; height: 42px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line-strong); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
        .adm-method-addr { margin-top: 6px; padding: 7px 10px; background: var(--surface); border-radius: 7px; font-family: var(--mono); font-size: 0.6rem; color: var(--ink-dim); word-break: break-all; line-height: 1.6; }
        .adm-icon-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; transition: all 0.12s; color: var(--ink-dim); flex-shrink: 0; }
        .adm-icon-btn:hover { background: var(--surface-hover); color: var(--ink); }
        .adm-icon-btn.danger:hover { background: var(--red-l); border-color: var(--red); color: var(--red); }
        .adm-toggle { position: relative; width: 36px; height: 20px; cursor: pointer; flex-shrink: 0; }
        .adm-toggle input { opacity: 0; width: 0; height: 0; }
        .adm-toggle-track { position: absolute; inset: 0; background: var(--surface-hover); border-radius: 10px; transition: background 0.2s; }
        .adm-toggle-track::before { content: ''; position: absolute; width: 14px; height: 14px; left: 3px; top: 3px; background: var(--ink-faint); border-radius: 50%; transition: transform 0.2s; }
        .adm-toggle input:checked + .adm-toggle-track { background: var(--green); }
        .adm-toggle input:checked + .adm-toggle-track::before { transform: translateX(16px); background: var(--bg-adm); }
        .adm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; backdrop-filter: blur(2px); animation: fadein 0.2s; }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        .adm-drawer { position: fixed; bottom: 0; left: 0; right: 0; max-width: 560px; margin: 0 auto; background: var(--card-adm); border-radius: 22px 22px 0 0; border-top: 1px solid var(--line-strong); padding: 0 22px 44px; z-index: 201; max-height: 92vh; overflow-y: auto; animation: slideup 0.3s cubic-bezier(0.32,0.72,0,1); }
        @keyframes slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .adm-drawer-handle { width: 36px; height: 4px; background: var(--line-strong); border-radius: 2px; margin: 12px auto 20px; }
        .adm-drawer-title { font-size: 1rem; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; margin-bottom: 20px; }
        .adm-field { margin-bottom: 14px; }
        .adm-field-label { display: block; font-size: 0.58rem; font-weight: 600; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
        .adm-input { width: 100%; background: var(--surface); border: 1.5px solid var(--line-strong); border-radius: 10px; padding: 10px 13px; font-family: var(--sans); font-size: 0.8rem; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .adm-input:focus { border-color: var(--accent); }
        .adm-input::placeholder { color: var(--ink-faint); }
        textarea.adm-input { resize: vertical; min-height: 76px; line-height: 1.5; font-family: var(--mono); font-size: 0.7rem; }
        .adm-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .adm-icon-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .adm-icon-pick { width: 36px; height: 36px; border-radius: 8px; background: var(--surface); border: 1.5px solid var(--line-strong); display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer; transition: all 0.12px; }
        .adm-icon-pick.sel { border-color: var(--accent); background: var(--surface-hover); }
        .adm-checkbox-row { display: flex; align-items: center; gap: 10px; padding: 11px 13px; background: var(--surface); border: 1.5px solid var(--line-strong); border-radius: 10px; cursor: pointer; }
        .adm-checkbox-row input { width: 15px; height: 15px; accent-color: var(--accent); cursor: pointer; }
        .adm-drawer-footer { display: flex; gap: 10px; margin-top: 20px; }
        .adm-btn-save { flex: 1; background: var(--accent); color: var(--bg-adm); border: none; border-radius: 10px; padding: 12px; font-family: var(--sans); font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }
        .adm-btn-save:hover { opacity: 0.88; }
        .adm-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
        .adm-btn-cancel { background: var(--surface); color: var(--ink-dim); border: 1px solid var(--line-strong); border-radius: 10px; padding: 12px 18px; font-family: var(--sans); font-size: 0.78rem; font-weight: 600; cursor: pointer; }
        .adm-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--card-adm); border: 1px solid var(--line-strong); color: var(--ink); padding: 9px 18px; border-radius: 20px; z-index: 300; font-size: 0.72rem; font-weight: 500; white-space: nowrap; animation: fadein 0.2s; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .adm-toast.ok  { background: var(--green-l); color: var(--green); border-color: var(--green); }
        .adm-toast.err { background: var(--red-l); color: var(--red); border-color: var(--red); }
        .adm-add-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; background: var(--accent); color: var(--bg-adm); border: none; border-radius: 10px; font-family: var(--sans); font-size: 0.72rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }
        .adm-add-btn:hover { opacity: 0.88; }
      `}</style>

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
                        
