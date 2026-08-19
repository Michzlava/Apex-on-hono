import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './deposit.css';

type DepositMethod = {
  id: string;
  label: string;
  icon: string;
  logoUrl?: string;
  address: string;
  network?: string;
  note?: string;
};

type Deposit = {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  methodLabel?: string;
  createdAt: string;
};

function fmt(n: number | null | undefined, d = 2) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function isBankTransfer(method: DepositMethod | undefined) {
  if (!method) return false;
  const label = method.label.toLowerCase();
  return label.includes('bank') || label.includes('wire') || label.includes('transfer') || label.includes('ach');
}

/* ── Inline SVG Icons (replacing lucide-react) ── */
const ArrowLeft = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const Copy = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const CheckCircle = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const Loader2 = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
  </svg>
);
const Clock = ({ size = 16, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const CheckCircle2 = ({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
  </svg>
);
const XCircle = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);
const MessageCircle = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);
const Building2 = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
  </svg>
);

function StatusBadge({ status }: { status: 'PENDING' | 'COMPLETED' | 'REJECTED' }) {
  const map = {
    PENDING:   { bg: 'rgba(251,191,36,0.1)',  col: '#fbbf24', border: 'rgba(251,191,36,0.25)',  label: 'Pending'   },
    COMPLETED: { bg: 'rgba(34,212,122,0.1)',  col: '#22d47a', border: 'rgba(34,212,122,0.25)',  label: 'Confirmed' },
    REJECTED:  { bg: 'rgba(248,113,113,0.1)', col: '#f87171', border: 'rgba(248,113,113,0.25)', label: 'Rejected'  },
  };
  const s = map[status];
  return (
    <span style={{
      background: s.bg, color: s.col,
      border: `1px solid ${s.border}`,
      padding: '2px 9px', borderRadius: 20,
      fontSize: '0.55rem', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      fontFamily: 'var(--mono)', whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function BankTransferPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="dp-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '2px solid color-mix(in srgb, var(--accent) 20%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Building2 size={24} color="var(--accent)" />
        </div>
        <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
          Your Bank Account is Ready
        </p>
        <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', lineHeight: 1.75, maxWidth: 320, margin: '0 auto' }}>
          We assign a dedicated bank account to each client. Your unique account details — including routing number, account number, and reference code — are provided privately through our support team to keep your information secure.
        </p>
      </div>

      <div className="dp-card">
        <div className="dp-card-accent" />
        <p className="dp-section-lbl">How it works</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { step: '01', title: 'Request your details', desc: 'Contact live support to receive your personal bank account credentials.' },
            { step: '02', title: 'Initiate a wire or ACH', desc: 'Send funds directly from your bank using the provided account and routing numbers.' },
            { step: '03', title: 'Funds credited', desc: 'Wire transfers are typically reflected within 1–2 business days after your bank processes them.' },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono)', fontSize: '0.52rem', fontWeight: 700,
                color: 'var(--accent)', letterSpacing: '0.05em',
              }}>
                {step}
              </span>
              <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{title}</p>
                <p style={{ fontSize: '0.63rem', color: 'var(--ink-faint)', lineHeight: 1.65 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dp-note" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>🔒</span>
        <p style={{ fontSize: '0.65rem', color: 'var(--gold)', lineHeight: 1.65 }}>
          For your security, bank account details are never displayed here. Always verify that you are speaking with an official Apex Markets support agent before sharing any information.
        </p>
      </div>

      <Link to="/dashboard/support" style={{ textDecoration: 'none' }}>
        <button className="dp-submit" style={{ marginTop: 0 }}>
          <MessageCircle size={16} />
          Contact Live Support
        </button>
      </Link>
    </div>
  );
}

export default function DepositPage() {
  const [methods, setMethods]         = useState<DepositMethod[]>([]);
  const [methodsLoading, setML]       = useState(true);
  const [selectedMethod, setSelected] = useState('');
  const [amount, setAmount]           = useState('');
  const [copied, setCopied]           = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submitErr, setSubmitErr]     = useState('');
  const [history, setHistory]         = useState<Deposit[]>([]);
  const [historyLoading, setHL]       = useState(true);

  const fetchMethods = useCallback(async () => {
    setML(true);
    try {
      const res = await fetch('/api/admin/deposit-methods', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setMethods(d);
        if (d.length > 0) setSelected(d[0].id);
      }
    } finally { setML(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHL(true);
    try {
      const res = await fetch('/api/user/deposits', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setHistory(d.deposits ?? []);
      }
    } finally { setHL(false); }
  }, []);

  useEffect(() => { fetchMethods(); fetchHistory(); }, [fetchMethods, fetchHistory]);

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true); setSubmitErr('');
    try {
      const active = methods.find(m => m.id === selectedMethod);
      const res = await fetch('/api/user/deposits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          currency: 'USD',
          methodId: selectedMethod,
          methodLabel: active?.label,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitErr(d.error ?? 'Failed to submit deposit');
        return;
      }
      setSubmitted(true);
      fetchHistory();
    } catch { setSubmitErr('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const resetForm = () => { setSubmitted(false); setAmount(''); setSubmitErr(''); };
  const active = methods.find(m => m.id === selectedMethod);
  const isBank = isBankTransfer(active);

  return (
    <div className="dp-wrap">
      <div className="dp-inner">

        <Link to="/dashboard" className="dp-back">
          <ArrowLeft size={13} /> Back
        </Link>

        <div className="dp-header">
          <p className="dp-header-eyebrow">Apex · Markets</p>
          <h1>Deposit Funds</h1>
          <p>Send crypto or fiat to your account</p>
        </div>

        <div className="dp-grid">

          {/* ══ LEFT COLUMN ══ */}
          <div className="dp-col-left">

            {/* ── SELECT METHOD ── */}
            <div className="dp-card">
              <div className="dp-card-accent" />
              <p className="dp-section-lbl">Select Method</p>
              {methodsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                  <Loader2 size={20} className="dp-spin" />
                </div>
              ) : methods.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔧</p>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    No deposit methods configured
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)' }}>Please contact support.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {methods.map(m => (
                    <button
                      key={m.id}
                      className={`dp-pill${selectedMethod === m.id ? ' active' : ''}`}
                      onClick={() => { setSelected(m.id); resetForm(); }}
                    >
                      {m.logoUrl ? (
                        <>
                          <img
                            src={m.logoUrl}
                            alt={m.label}
                            className="dp-pill-logo"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              img.style.display = 'none';
                              const fallback = img.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <span className="dp-pill-logo-fallback">{m.icon}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 14 }}>{m.icon}</span>
                      )}
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── BANK TRANSFER PANEL ── */}
            {active && isBank && <BankTransferPanel />}

            {/* ── CRYPTO: ADDRESS ── */}
            {active && !isBank && (
              <div className="dp-card">
                <div className="dp-card-accent" />
                <p className="dp-section-lbl">Deposit Address</p>

                <div className="dp-method-header">
                  {active.logoUrl ? (
                    <>
                      <img
                        src={active.logoUrl}
                        alt={active.label}
                        className="dp-method-header-logo"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          const fallback = img.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <span className="dp-method-header-fallback">{active.icon}</span>
                    </>
                  ) : (
                    <span style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--surface)', border: '1px solid var(--line)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {active.icon}
                    </span>
                  )}
                  <div>
                    <p className="dp-method-header-name">{active.label}</p>
                    {active.network && (
                      <p className="dp-method-header-sub">Network: {active.network}</p>
                    )}
                  </div>
                </div>

                <div className="dp-address-box">
                  <p className="dp-address-label">Send {active.label} to this address</p>
                  <p className="dp-address-text">{active.address}</p>
                  <button
                    className="dp-copy-btn"
                    onClick={() => copyAddress(active.address)}
                    style={{
                      background: copied
                        ? 'color-mix(in srgb, var(--green) 10%, transparent)'
                        : 'var(--surface)',
                      color: copied ? 'var(--green)' : 'var(--ink-dim)',
                      border: `1px solid ${copied
                        ? 'color-mix(in srgb, var(--green) 20%, transparent)'
                        : 'var(--line)'}`,
                    }}
                  >
                    {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy Address'}
                  </button>
                </div>

                {active.note && (
                  <div className="dp-note">
                    <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>⚠️</span>
                    <p>{active.note}</p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div className="dp-col-right">

            {/* ── CRYPTO: CONFIRM AMOUNT ── */}
            {active && !isBank && !submitted && (
              <div className="dp-card">
                <div className="dp-card-accent" />
                <p className="dp-section-lbl">Confirm Amount Sent</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', marginBottom: 16, lineHeight: 1.6 }}>
                  After sending, enter the USD value below. Your deposit will be reviewed and credited shortly.
                </p>

                <div className="dp-amount-row">
                  <span className="dp-currency">$</span>
                  <input
                    className="dp-input"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="0"
                  />
                </div>

                <div className="dp-quick">
                  {['100', '500', '1000', '5000'].map(q => (
                    <button
                      key={q}
                      className={`dp-quick-btn${amount === q ? ' active' : ''}`}
                      onClick={() => setAmount(q)}
                    >
                      ${q}
                    </button>
                  ))}
                </div>

                {submitErr && (
                  <p style={{ fontSize: '0.65rem', color: 'var(--red)', marginTop: 10, textAlign: 'center' }}>
                    {submitErr}
                  </p>
                )}

                <button
                  className="dp-submit"
                  disabled={!amount || Number(amount) <= 0 || submitting}
                  onClick={handleSubmit}
                >
                  {submitting
                    ? <><Loader2 size={16} className="dp-spin" /> Submitting…</>
                    : `Confirm $${amount || '0'} Deposit`
                  }
                </button>
              </div>
            )}

            {/* ── SUCCESS ── */}
            {submitted && !isBank && (
              <div className="dp-card">
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '12px 0 8px', textAlign: 'center',
                }}>
                  <div className="dp-success-icon">
                    <CheckCircle2 size={28} color="var(--green)" />
                  </div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                    Deposit Submitted
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginBottom: 24, lineHeight: 1.7 }}>
                    Your deposit of{' '}
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>${fmt(Number(amount))}</span>{' '}
                    via {active?.label} is under review.<br />
                    Funds will be credited within 1–24 hours.
                  </p>
                  <button className="dp-another-btn" onClick={resetForm}>
                    Make Another Deposit
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* ══ HISTORY — full width on desktop ══ */}
          <div className="dp-card dp-history-card">
            <p className="dp-section-lbl">Deposit History</p>
            {historyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <Loader2 size={18} className="dp-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="dp-empty-state">
                <Clock size={22} strokeWidth={1.5} />
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.65rem', letterSpacing: '0.06em' }}>
                  No deposits yet
                </p>
              </div>
            ) : (
              <div>
                {history.map(d => (
                  <div key={d.id} className="dp-history-row">
                    <div className={`dp-status-icon ${d.status.toLowerCase()}`}>
                      {d.status === 'COMPLETED' ? <CheckCircle2 size={16} />
                        : d.status === 'REJECTED' ? <XCircle size={16} />
                        : <Clock size={16} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 700,
                        color: 'var(--ink)', marginBottom: 3,
                      }}>
                        ${fmt(d.amount)}{' '}
                        <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>{d.currency}</span>
                      </p>
                      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--ink-faint)' }}>
                        {d.methodLabel && `${d.methodLabel} · `}{fmtDate(d.createdAt)}
                      </p>
                    </div>

                    <StatusBadge status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
