import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Loader2, XCircle, User, Mail,
  ShieldCheck, Wallet, Calendar, KeyRound, Save, X,
  Phone, Globe, Send, Pencil,
} from 'lucide-react';

type KycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface EmailLog {
  id: string;
  subject: string;
  message: string;
  sentAt: string;
}

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  role: string;
  kycStatus: KycStatus;
  portfolioBalance: number;
  createdAt: string;
}

const BALANCE_ACTIONS = [
  { value: 'add',          label: 'Add to Balance',        description: 'Manual credit / deposit',    sign: '+' },
  { value: 'subtract',     label: 'Subtract from Balance', description: 'Manual debit / withdrawal',  sign: '-' },
  { value: 'trade_profit', label: 'Trade Profit',          description: 'Profit — increases balance', sign: '+' },
  { value: 'trade_loss',   label: 'Trade Loss',            description: 'Loss — reduces balance',     sign: '-' },
];

function initials(name?: string | null, email?: string) {
  if (name) return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

function KycBadge({ status }: { status: KycStatus }) {
  const map: Record<KycStatus, [string, string]> = {
    NONE:     ['var(--surface)',  'var(--ink-faint)'],
    PENDING:  ['var(--gold-l)',   'var(--gold)'],
    APPROVED: ['var(--green-l)', 'var(--green)'],
    REJECTED: ['var(--red-l)',   'var(--red)'],
  };
  const [bg, col] = map[status];
  return (
    <span style={{
      background: bg, color: col,
      padding: '3px 10px', borderRadius: 20,
      fontSize: '0.55rem', fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      fontFamily: 'var(--mono)',
    }}>
      {status}
    </span>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = params.id;

  const [user, setUser]       = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [phone, setPhone]       = useState('');
  const [country, setCountry]   = useState('');
  const [kycStatus, setKyc]     = useState<KycStatus>('NONE');
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState('');
  const [emailEditable, setEmailEditable] = useState(false);

  const [showBalanceModal, setShowBalanceModal]   = useState(false);
  const [amount, setAmount]                       = useState('');
  const [balanceAction, setBalanceAction]         = useState('add');
  const [balanceNote, setBalanceNote]             = useState('');
  const [processingBalance, setProcessingBalance] = useState(false);

  const [showResetModal, setShowResetModal]   = useState(false);
  const [newPassword, setNewPassword]         = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject]     = useState('');
  const [emailMessage, setEmailMessage]     = useState('');
  const [sendingEmail, setSendingEmail]     = useState(false);
  const [emailStatus, setEmailStatus]       = useState('');
  const [emailLogs, setEmailLogs]           = useState<EmailLog[]>([]);
  const [loadingLogs, setLoadingLogs]       = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) { setError('User not found'); return; }
      const data = await res.json();
      const raw = data.user ?? data;
      const u = {
        ...raw,
        name: [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim() || null,
      };
      setUser(u);
      setName(u.name ?? '');
      setEmail(u.email ?? '');
      setPhone(u.phone ?? '');
      setCountry(u.country ?? '');
      setKyc(u.kycStatus ?? 'NONE');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const handleSave = async () => {
    setSaving(true); setSaveErr('');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, phone, country, kycStatus }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveErr(d.error ?? 'Failed to save');
        return;
      }
      const data = await res.json();
      const u = data.user ?? data;
      setUser(prev => prev ? { ...prev, ...u, phone: phone || prev.phone, country: country || prev.country } : u);
      setEditing(false);
      setEmailEditable(false);
      showToast('User updated successfully');
    } catch { setSaveErr('Network error'); }
    finally { setSaving(false); }
  };

  const isCredit = balanceAction === 'add' || balanceAction === 'trade_profit';
  const resolvedApiType = () => {
    if (balanceAction === 'trade_profit') return 'add';
    if (balanceAction === 'trade_loss')   return 'subtract';
    return balanceAction;
  };

  const handleUpdateBalance = async () => {
    if (!amount) return;
    setProcessingBalance(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: parseFloat(amount),
          type: resolvedApiType(),
          note: balanceNote || undefined,
          source: balanceAction,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newBal = data.user ? Number(data.user.portfolioBalance) : Number(data.portfolioBalance);
        setUser(prev => prev ? { ...prev, portfolioBalance: newBal } : prev);
        setShowBalanceModal(false);
        setAmount(''); setBalanceNote(''); setBalanceAction('add');
        showToast('Balance updated');
      } else {
        showToast('Update failed', false);
      }
    } catch { showToast('Network error', false); }
    finally { setProcessingBalance(false); }
  };

  const closeBalanceModal = () => {
    setShowBalanceModal(false);
    setAmount(''); setBalanceNote(''); setBalanceAction('add');
  };

  const confirmResetPassword = async () => {
    if (!newPassword) return;
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        showToast('Password updated successfully');
        setShowResetModal(false);
        setNewPassword('');
      } else {
        showToast('Reset failed', false);
      }
    } catch { showToast('Network error', false); }
    finally { setResettingPassword(false); }
  };

  const openEmailModal = async () => {
    setShowEmailModal(true);
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/admin/send-email?userId=${id}`, { credentials: 'include' });
      const data = await res.json();
      setEmailLogs(data.logs || []);
    } catch {}
    finally { setLoadingLogs(false); }
  };

  const handleSendEmail = async () => {
    if (!emailSubject || !emailMessage) return;
    setSendingEmail(true); setEmailStatus('');
    try {
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: id, subject: emailSubject, message: emailMessage }),
      });
      if (res.ok) {
        setEmailStatus('✅ Email sent successfully');
        setEmailSubject(''); setEmailMessage('');
        const logsRes = await fetch(`/api/admin/send-email?userId=${id}`, { credentials: 'include' });
        const logsData = await logsRes.json();
        setEmailLogs(logsData.logs || []);
      } else {
        const data = await res.json();
        setEmailStatus(`❌ ${data.error || 'Failed to send'}`);
      }
    } catch { setEmailStatus('❌ Network error'); }
    finally {
      setSendingEmail(false);
      setTimeout(() => setEmailStatus(''), 4000);
    }
  };

  const KYC_OPTIONS: KycStatus[] = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'];

  return (
    <>
      <style>{`
        .ud-wrap { max-width: 600px; margin: 0 auto; padding: 24px 16px 80px; background: var(--bg-adm); min-height: 100vh; }
        .ud-back { display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 600; color: var(--ink-dim); margin-bottom: 20px; padding: 6px 12px; background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 8px; transition: background 0.12s; cursor: pointer; font-family: var(--sans); }
        .ud-back:hover { background: var(--surface-hover); }
        .ud-brand { font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.18em; color: var(--accent); text-transform: uppercase; margin-bottom: 4px; }
        .ud-title { font-size: 1.4rem; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; margin-bottom: 20px; }
        .ud-profile { background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; padding: 22px 20px; margin-bottom: 12px; position: relative; overflow: hidden; }
        .ud-profile-stripe { position: absolute; top: 0; left: 0; bottom: 0; width: 3px; background: var(--accent); border-radius: 3px 0 0 3px; }
        .ud-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--accent); color: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; font-weight: 700; flex-shrink: 0; font-family: var(--sans); }
        .ud-edit-btn { display: flex; align-items: center; gap: 6px; padding: 7px 14px; background: var(--surface); color: var(--accent); border: 1px solid var(--line-strong); border-radius: 8px; font-family: var(--sans); font-size: 0.68rem; font-weight: 600; cursor: pointer; transition: background 0.12s; flex-shrink: 0; }
        .ud-edit-btn:hover { background: var(--surface-hover); }
        .ud-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .ud-action-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; font-family: var(--sans); font-size: 0.7rem; font-weight: 600; cursor: pointer; border: 1px solid; transition: opacity 0.12s; }
        .ud-action-btn:hover { opacity: 0.8; }
        .ud-action-btn.primary { background: var(--green-l); color: var(--accent); border-color: var(--green); }
        .ud-action-btn.danger  { background: var(--red-l);   color: var(--red);    border-color: var(--line); }
        .ud-action-btn.warning { background: var(--card-adm);  color: var(--gold);   border-color: var(--line); }
        .ud-info-grid { background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; overflow: hidden; margin-bottom: 12px; }
        .ud-info-row { display: flex; align-items: center; gap: 14px; padding: 14px 18px; border-bottom: 1px solid var(--line); }
        .ud-info-row:last-child { border-bottom: none; }
        .ud-info-ico { width: 32px; height: 32px; border-radius: 8px; background: var(--surface); border: 1px solid var(--line-strong); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--ink-faint); }
        .ud-info-label { font-size: 0.58rem; font-weight: 600; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; font-family: var(--sans); }
        .ud-info-val { font-size: 0.82rem; font-weight: 500; color: var(--ink); font-family: var(--sans); }
        .ud-info-val.mono { font-family: var(--mono); font-size: 0.75rem; }
        .ud-info-val.large { font-size: 1.3rem; font-weight: 700; color: var(--ink); letter-spacing: -0.02em; font-family: var(--mono); }
        .ud-info-val.faint { color: var(--ink-faint); font-style: italic; }
        .ud-form { background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; padding: 20px; margin-bottom: 12px; }
        .ud-form-title { font-size: 0.88rem; font-weight: 700; color: var(--ink); margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; font-family: var(--sans); }
        .ud-field { margin-bottom: 14px; }
        .ud-field-label { display: block; font-size: 0.58rem; font-weight: 600; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; font-family: var(--sans); }
        .ud-input { width: 100%; background: var(--surface); border: 1.5px solid var(--line-strong); border-radius: 10px; padding: 10px 13px; font-family: var(--sans); font-size: 0.8rem; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .ud-input:focus { border-color: var(--accent); background: var(--card-adm); }
        .ud-input::placeholder { color: var(--ink-faint); }
        .ud-input:disabled { color: var(--ink-faint); cursor: not-allowed; opacity: 0.6; }
        textarea.ud-input { resize: none; line-height: 1.6; }
        .ud-kyc-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .ud-kyc-pill { padding: 6px 14px; border-radius: 20px; border: 1.5px solid var(--line-strong); background: var(--card); font-family: var(--sans); font-size: 0.65rem; font-weight: 600; cursor: pointer; transition: all 0.12s; color: var(--ink-dim); }
        .ud-kyc-pill.sel-NONE     { background: var(--surface);  border-color: var(--line-strong); color: var(--ink-dim); }
        .ud-kyc-pill.sel-PENDING  { background: var(--gold-l);   border-color: var(--gold);        color: var(--gold); }
        .ud-kyc-pill.sel-APPROVED { background: var(--green-l);  border-color: var(--green);       color: var(--green); }
        .ud-kyc-pill.sel-REJECTED { background: var(--red-l);    border-color: var(--red);         color: var(--red); }
        .ud-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .ud-form-btns { display: flex; gap: 10px; margin-top: 20px; }
        .ud-btn-save { flex: 1; background: var(--accent); color: var(--bg-adm); border: none; border-radius: 10px; padding: 12px; font-family: var(--sans); font-size: 0.78rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .ud-btn-save:hover { opacity: 0.88; }
        .ud-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
        .ud-btn-cancel { background: var(--surface); color: var(--ink-dim); border: 1px solid var(--line-strong); border-radius: 10px; padding: 12px 18px; font-family: var(--sans); font-size: 0.78rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .ud-err { font-size: 0.65rem; color: var(--red); margin-top: 8px; font-family: var(--sans); }
        .ud-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .ud-modal { background: var(--card-adm); border: 1px solid var(--line-strong); border-radius: 14px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); overflow: hidden; }
        .ud-modal.lg { max-width: 520px; max-height: 88vh; display: flex; flex-direction: column; }
        .ud-modal-head { padding: 16px 20px; border-bottom: 1px solid var(--line-strong); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .ud-modal-head-title { font-size: 0.82rem; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 8px; font-family: var(--sans); }
        .ud-modal-close { background: none; border: none; cursor: pointer; color: var(--ink-faint); display: flex; align-items: center; padding: 4px; border-radius: 6px; transition: background 0.1s; }
        .ud-modal-close:hover { background: var(--surface-hover); color: var(--ink); }
        .ud-modal-body { padding: 20px; }
        .ud-modal-scroll { overflow-y: auto; flex: 1; }
        .ud-op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ud-op-card { text-align: left; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--surface); cursor: pointer; transition: all 0.12s; font-family: var(--sans); }
        .ud-op-card:hover { border-color: var(--accent); }
        .ud-op-card.sel-credit { background: var(--green-l); border-color: var(--green); }
        .ud-op-card.sel-debit  { background: var(--red-l);   border-color: var(--red); }
        .ud-op-sign { font-size: 0.65rem; font-weight: 800; margin-right: 4px; font-family: var(--mono); }
        .ud-op-sign.credit { color: var(--green); }
        .ud-op-sign.debit  { color: var(--red); }
        .ud-op-label { font-size: 0.7rem; font-weight: 600; color: var(--ink); }
        .ud-op-desc { font-size: 0.6rem; color: var(--ink-faint); margin-top: 2px; font-family: var(--mono); }
        .ud-amount-wrap { position: relative; }
        .ud-amount-sign { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 0.85rem; font-weight: 700; font-family: var(--mono); pointer-events: none; }
        .ud-amount-sign.credit { color: var(--green); }
        .ud-amount-sign.debit  { color: var(--red); }
        .ud-amount-input { padding-left: 26px !important; }
        .ud-preview { font-size: 0.65rem; font-family: var(--mono); color: var(--ink-faint); margin-top: 5px; }
        .ud-preview .credit { color: var(--green); font-weight: 600; }
        .ud-preview .debit  { color: var(--red);   font-weight: 600; }
        .ud-modal-btns { display: flex; gap: 10px; margin-top: 20px; }
        .ud-mbtn { flex: 1; padding: 11px; border-radius: 10px; border: none; font-family: var(--sans); font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: opacity 0.12s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .ud-mbtn:hover { opacity: 0.85; }
        .ud-mbtn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ud-mbtn.ghost  { background: var(--surface);  color: var(--ink-dim); border: 1px solid var(--line-strong); }
        .ud-mbtn.credit { background: var(--green-l);  color: var(--green);  border: 1px solid var(--green); font-weight: 700; }
        .ud-mbtn.debit  { background: var(--red-l);    color: var(--red);    border: 1px solid var(--red);   font-weight: 700; }
        .ud-mbtn.danger { background: var(--red-l);    color: var(--red);    border: 1px solid var(--red);   font-weight: 700; }
        .ud-mbtn.send   { background: var(--accent);   color: var(--bg);     font-weight: 700; }
        .ud-email-log { background: var(--surface); border: 1px solid var(--line-strong); border-radius: 10px; padding: 12px; margin-bottom: 8px; }
        .ud-email-log-subject { font-size: 0.75rem; font-weight: 600; color: var(--ink); margin-bottom: 3px; }
        .ud-email-log-meta { font-size: 0.6rem; color: var(--ink-faint); font-family: var(--mono); margin-bottom: 5px; }
        .ud-email-log-msg { font-size: 0.65rem; color: var(--ink-dim); font-family: var(--mono); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ud-section-label { font-size: 0.58rem; font-weight: 700; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; font-family: var(--sans); }
        .ud-email-status { font-size: 0.68rem; font-family: var(--mono); padding: 8px 12px; border-radius: 8px; margin-top: 4px; }
        .ud-email-status.ok  { background: var(--green-l); color: var(--green); border: 1px solid var(--green); }
        .ud-email-status.err { background: var(--red-l);   color: var(--red);   border: 1px solid var(--red); }
        .ud-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 10px; color: var(--ink-faint); }
        .ud-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--card-adm); border: 1px solid var(--line-strong); color: var(--ink); padding: 9px 18px; border-radius: 20px; z-index: 300; font-size: 0.72rem; font-weight: 500; white-space: nowrap; animation: fadein 0.2s; box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-family: var(--sans); }
        .ud-toast.ok  { background: var(--green-l); color: var(--green); border-color: var(--green); }
        .ud-toast.err { background: var(--red-l);   color: var(--red);   border-color: var(--red); }
        .ud-role { font-family: var(--mono); font-size: 0.5rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 8px; border-radius: 20px; background: var(--surface); color: var(--ink-faint); }
        .ud-role.admin { color: var(--accent); border: 1px solid var(--accent); }
        .ud-divider { height: 1px; background: var(--line-strong); margin: 20px 0; }
        .ud-spin { animation: spin 0.7s linear infinite; }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 480px) { .ud-grid-2 { grid-template-columns: 1fr; } }
      `}</style>

      <div className="ud-wrap">
        <button onClick={() => navigate(-1)} className="ud-back">
          <ArrowLeft size={13} /> Back to Users
        </button>

        <p className="ud-brand">Apex · Markets</p>
        <h1 className="ud-title">User Detail</h1>

        {loading && (
          <div className="ud-center">
            <Loader2 size={24} className="ud-spin" />
            <p style={{ fontSize: '0.72rem', fontFamily: 'var(--sans)' }}>Loading user…</p>
          </div>
        )}

        {!loading && error && (
          <div className="ud-center">
            <XCircle size={28} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink)' }}>{error}</p>
            <button onClick={() => navigate(-1)} className="ud-back" style={{ marginTop: 8 }}>
              <ArrowLeft size={13} /> Go back
            </button>
          </div>
        )}

        {!loading && user && !editing && (
          <>
            <div className="ud-profile">
              <div className="ud-profile-stripe" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="ud-avatar">{initials(user.name, user.email)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', marginBottom: 3, fontFamily: 'var(--sans)' }}>
                    {user.name || 'Unnamed User'}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginBottom: 6, fontFamily: 'var(--sans)' }}>{user.email}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <KycBadge status={user.kycStatus} />
                    <span className={`ud-role${user.role === 'ADMIN' ? ' admin' : ''}`}>{user.role}</span>
                  </div>
                </div>
                <button className="ud-edit-btn" onClick={() => { setSaveErr(''); setEditing(true); }}>
                  <Edit size={12} /> Edit
                </button>
              </div>
            </div>

            <div className="ud-actions">
              <button className="ud-action-btn primary" onClick={() => setShowBalanceModal(true)}>
                <Wallet size={13} /> Adjust Balance
              </button>
              <button className="ud-action-btn warning" onClick={openEmailModal}>
                <Mail size={13} /> Send Email
              </button>
              <button className="ud-action-btn danger" onClick={() => setShowResetModal(true)}>
                <KeyRound size={13} /> Reset Password
              </button>
            </div>

            <div className="ud-info-grid">
              {[
                { icon: <Wallet size={15} />, label: 'Portfolio Balance', val: <p className="ud-info-val large">${(user.portfolioBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p> },
                { icon: <Mail size={15} />,   label: 'Email Address',    val: <p className="ud-info-val">{user.email}</p> },
                { icon: <Phone size={15} />,  label: 'Phone',            val: <p className={`ud-info-val${!user.phone ? ' faint' : ''}`}>{user.phone || 'Not provided'}</p> },
                { icon: <Globe size={15} />,  label: 'Country',          val: <p className={`ud-info-val${!user.country ? ' faint' : ''}`}>{user.country || 'Not provided'}</p> },
                { icon: <ShieldCheck size={15} />, label: 'KYC Status',  val: <div style={{ marginTop: 2 }}><KycBadge status={user.kycStatus} /></div> },
                { icon: <User size={15} />,   label: 'Role',             val: <p className="ud-info-val">{user.role}</p> },
                { icon: <KeyRound size={15} />, label: 'User ID',        val: <p className="ud-info-val mono">{user.id}</p> },
                { icon: <Calendar size={15} />, label: 'Member Since',   val: <p className="ud-info-val">{fmtDate(user.createdAt)}</p> },
              ].map(({ icon, label, val }) => (
                <div key={label} className="ud-info-row">
                  <div className="ud-info-ico">{icon}</div>
                  <div style={{ flex: 1 }}>
                    <p className="ud-info-label">{label}</p>
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && user && editing && (
          <div className="ud-form">
            <div className="ud-form-title">
              Edit User
              <button onClick={() => { setEditing(false); setSaveErr(''); setEmailEditable(false); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', display: 'flex', alignItems: 'center' }}>
                <X size={16} />
              </button>
            </div>

            <div className="ud-grid-2">
              <div className="ud-field">
                <label className="ud-field-label">Full Name</label>
                <input className="ud-input" value={name} onChange={e => setName(e.target.value)} placeholder="User's full name" />
              </div>
              <div className="ud-field">
                <label className="ud-field-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  Email Address
                  {!emailEditable && (
                    <button onClick={() => setEmailEditable(true)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.58rem', fontWeight: 600, fontFamily: 'var(--sans)' }}>
                      <Pencil size={9} /> Change
                    </button>
                  )}
                </label>
                <input className="ud-input" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!emailEditable} placeholder="user@example.com" />
              </div>
            </div>

            <div className="ud-grid-2">
              <div className="ud-field">
                <label className="ud-field-label">Phone</label>
                <input className="ud-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
              </div>
              <div className="ud-field">
                <label className="ud-field-label">Country</label>
                <input className="ud-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="United States" />
              </div>
            </div>

            <div className="ud-field">
              <label className="ud-field-label">KYC Status</label>
              <div className="ud-kyc-pills" style={{ marginTop: 6 }}>
                {KYC_OPTIONS.map(opt => (
                  <button key={opt} className={`ud-kyc-pill${kycStatus === opt ? ` sel-${opt}` : ''}`} onClick={() => setKyc(opt)}>
                    {opt}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.58rem', color: 'var(--ink-faint)', marginTop: 8, lineHeight: 1.5, fontFamily: 'var(--sans)' }}>
                NONE → not started · PENDING → awaiting review · APPROVED / REJECTED → admin decision
              </p>
            </div>

            {saveErr && <p className="ud-err">✕ {saveErr}</p>}

            <div className="ud-form-btns">
              <button className="ud-btn-cancel" onClick={() => { setEditing(false); setSaveErr(''); setEmailEditable(false); }}>
                <X size={13} /> Cancel
              </button>
              <button className="ud-btn-save" disabled={saving} onClick={handleSave}>
                {saving ? <><Loader2 size={14} className="ud-spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Balance Modal */}
      {showBalanceModal && (
        <div className="ud-overlay">
          <div className="ud-modal">
            <div className="ud-modal-head">
              <span className="ud-modal-head-title"><Wallet size={14} /> Adjust Balance</span>
              <button className="ud-modal-close" onClick={closeBalanceModal}><X size={15} /></button>
            </div>
            <div className="ud-modal-body">
              <div className="ud-field">
                <label className="ud-field-label">Operation</label>
                <div className="ud-op-grid">
                  {BALANCE_ACTIONS.map(opt => {
                    const isPos = opt.sign === '+';
                    const sel = balanceAction === opt.value;
                    return (
                      <button key={opt.value}
                        className={`ud-op-card${sel ? (isPos ? ' sel-credit' : ' sel-debit') : ''}`}
                        onClick={() => setBalanceAction(opt.value)}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span className={`ud-op-sign ${isPos ? 'credit' : 'debit'}`}>{opt.sign}</span>
                          <span className="ud-op-label">{opt.label}</span>
                        </div>
                        <p className="ud-op-desc">{opt.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="ud-field">
                <label className="ud-field-label">Amount (USD)</label>
                <div className="ud-amount-wrap">
                  <span className={`ud-amount-sign ${isCredit ? 'credit' : 'debit'}`}>{isCredit ? '+' : '−'}</span>
                  <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="ud-input ud-amount-input" />
                </div>
                {amount && !isNaN(parseFloat(amount)) && (
                  <p className="ud-preview">
                    New balance: <span className={isCredit ? 'credit' : 'debit'}>
                      ${(isCredit ? (user?.portfolioBalance ?? 0) + parseFloat(amount) : (user?.portfolioBalance ?? 0) - parseFloat(amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
              </div>

              <div className="ud-field" style={{ marginBottom: 0 }}>
                <label className="ud-field-label">Note <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
                <input type="text" placeholder="e.g. BTC/USDT trade — closed at profit" value={balanceNote} onChange={e => setBalanceNote(e.target.value)} className="ud-input" />
              </div>

              <div className="ud-modal-btns">
                <button className="ud-mbtn ghost" onClick={closeBalanceModal}>Cancel</button>
                <button className={`ud-mbtn ${isCredit ? 'credit' : 'debit'}`} disabled={processingBalance || !amount} onClick={handleUpdateBalance}>
                  {processingBalance ? <Loader2 size={13} className="ud-spin" /> : 'Update Balance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="ud-overlay">
          <div className="ud-modal">
            <div className="ud-modal-head">
              <span className="ud-modal-head-title"><KeyRound size={14} /> Reset Password</span>
              <button className="ud-modal-close" onClick={() => { setShowResetModal(false); setNewPassword(''); }}><X size={15} /></button>
            </div>
            <div className="ud-modal-body">
              <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginBottom: 16, fontFamily: 'var(--mono)' }}>
                Setting new password for <span style={{ color: 'var(--ink)' }}>{user?.email}</span>
              </p>
              <div className="ud-field" style={{ marginBottom: 0 }}>
                <label className="ud-field-label">New Password</label>
                <input type="text" placeholder="Enter new password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="ud-input" />
              </div>
              <div className="ud-modal-btns">
                <button className="ud-mbtn ghost" onClick={() => { setShowResetModal(false); setNewPassword(''); }}>Cancel</button>
                <button className="ud-mbtn danger" disabled={resettingPassword || !newPassword} onClick={confirmResetPassword}>
                  {resettingPassword ? <Loader2 size={13} className="ud-spin" /> : 'Set Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Email Modal */}
      {showEmailModal && (
        <div className="ud-overlay">
          <div className="ud-modal lg">
            <div className="ud-modal-head">
              <span className="ud-modal-head-title"><Mail size={14} /> Send Email</span>
              <button className="ud-modal-close" onClick={() => setShowEmailModal(false)}><X size={15} /></button>
            </div>
            <div className="ud-modal-scroll">
              <div className="ud-modal-body" style={{ borderBottom: '1px solid var(--line-strong)' }}>
                <p style={{ fontSize: '0.65rem', fontFamily: 'var(--mono)', color: 'var(--ink-faint)', marginBottom: 14 }}>
                  To: <span style={{ color: 'var(--ink)' }}>{user?.name}</span>{' '}
                  <span style={{ color: 'var(--ink-faint)' }}>&lt;{user?.email}&gt;</span>
                </p>
                <div className="ud-field">
                  <label className="ud-field-label">Subject</label>
                  <input type="text" placeholder="e.g. Account Verification Required" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="ud-input" />
                </div>
                <div className="ud-field" style={{ marginBottom: 0 }}>
                  <label className="ud-field-label">Message</label>
                  <textarea rows={5} placeholder="Write your message here…" value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="ud-input" />
                </div>
                {emailStatus && (
                  <div className={`ud-email-status ${emailStatus.includes('✅') ? 'ok' : 'err'}`} style={{ marginTop: 12 }}>
                    {emailStatus}
                  </div>
                )}
                <div className="ud-modal-btns">
                  <button className="ud-mbtn ghost" onClick={() => setShowEmailModal(false)}>Cancel</button>
                  <button className="ud-mbtn send" disabled={sendingEmail || !emailSubject || !emailMessage} onClick={handleSendEmail}>
                    {sendingEmail ? <><Loader2 size={13} className="ud-spin" /> Sending…</> : <><Send size={13} /> Send Email</>}
                  </button>
                </div>
              </div>

              <div className="ud-modal-body">
                <p className="ud-section-label">Email History</p>
                {loadingLogs ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-faint)', fontSize: '0.7rem' }}>
                    <Loader2 size={12} className="ud-spin" /> Loading…
                  </div>
                ) : emailLogs.length === 0 ? (
                  <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>No emails sent to this user yet.</p>
                ) : emailLogs.map(log => (
                  <div key={log.id} className="ud-email-log">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <p className="ud-email-log-subject">{log.subject}</p>
                      <p className="ud-email-log-meta">{new Date(log.sentAt).toLocaleDateString()}</p>
                    </div>
                    <p className="ud-email-log-msg">{log.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`ud-toast ${toast.ok ? 'ok' : 'err'}`}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </>
  );
}
