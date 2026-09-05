import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
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
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function isBankTransfer(method: DepositMethod | undefined) {
  if (!method) return false;
  const label = method.label.toLowerCase();
  return label.includes('bank') || label.includes('wire') || label.includes('transfer') || label.includes('ach');
}

function StatusChip({ status }: { status: Deposit['status'] }) {
  const label = status === 'COMPLETED' ? 'CONFIRMED' : status;
  return <span className={`dp-chip ${status.toLowerCase()}`}>{label}</span>;
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
        if (d.length > 0) setSelected(prev => prev || d[0].id);
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
    navigator.clipboard?.writeText(address).catch(() => {});
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

  const completedTotal = history.filter(h => h.status === 'COMPLETED').reduce((a, h) => a + Number(h.amount || 0), 0);
  const pendingCount   = history.filter(h => h.status === 'PENDING').length;

  return (
    <div className="dp-wrap">

      {/* ══ header ══ */}
      <div className="dp-head">
        <div>
          <p className="dp-eyebrow"><span className="dp-eyebrow-pip" />Apex · Mkts — Funding</p>
          <h1 className="dp-title">Deposit Funds</h1>
        </div>
        <div className="dp-head-stats">
          <div className="dp-hstat">
            <span className="k">Total Credited</span>
            <span className="v">${fmt(completedTotal, 0)}</span>
          </div>
          <div className="dp-hstat">
            <span className="k">Pending</span>
            <span className={`v ${pendingCount ? 'pending' : ''}`}>{pendingCount}</span>
          </div>
        </div>
      </div>

      <div className="dp-grid">
        {/* ══════════ MAIN FLOW ══════════ */}
        <div className="dp-main">

          {/* ── step 1 · method ── */}
          <section className="dp-card">
            <header className="dp-card-head">
              <span className="dp-step">1</span>
              <h2>Select Method</h2>
            </header>
            {methodsLoading ? (
              <div className="dp-center"><div className="dp-spinner" /></div>
            ) : methods.length === 0 ? (
              <div className="dp-empty">
                <p className="dp-empty-ico">🔧</p>
                <p className="dp-empty-title">No deposit methods configured</p>
                <p className="dp-empty-sub">Please contact support.</p>
              </div>
            ) : (
              <div className="dp-methods">
                {methods.map(m => (
                  <button
                    key={m.id}
                    className={`dp-method ${selectedMethod === m.id ? 'on' : ''}`}
                    onClick={() => { setSelected(m.id); resetForm(); }}
                  >
                    <span className="dp-method-ico">
                      {m.logoUrl && (
                        <img src={m.logoUrl} alt=""
                          onError={e => e.currentTarget.parentElement?.classList.add('broken')} />
                      )}
                      <span className="dp-method-ico-fb">{m.icon}</span>
                    </span>
                    <span className="dp-method-lbl">{m.label}</span>
                    {m.network && <span className="dp-method-net">{m.network}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ── step 2 · crypto send ── */}
          {active && !isBank && (
            <section className="dp-card">
              <header className="dp-card-head">
                <span className="dp-step">2</span>
                <h2>Send {active.label}</h2>
                {active.network && <span className="dp-net-chip">Network · {active.network}</span>}
              </header>

              <div className="dp-pay">
                <div className="dp-qr">
                  <QRCodeSVG value={active.address} size={136} bgColor="#ffffff" fgColor="#0b0d11" level="M" />
                  <span className="dp-qr-hint">SCAN WITH WALLET</span>
                </div>
                <div className="dp-addr">
                  <p className="dp-addr-lbl">Deposit address</p>
                  <p className="dp-addr-text">{active.address}</p>
                  <button className={`dp-copy ${copied ? 'done' : ''}`} onClick={() => copyAddress(active.address)}>
                    {copied ? '✓ COPIED TO CLIPBOARD' : '⧉ COPY ADDRESS'}
                  </button>
                  <p className="dp-addr-hint">
                    Send only {active.label} on this network. Other assets or networks will be lost.
                  </p>
                </div>
              </div>

              {active.note && (
                <div className="dp-note">
                  <span>⚠️</span>
                  <p>{active.note}</p>
                </div>
              )}
            </section>
          )}

          {/* ── step 2 · bank wire ── */}
          {active && isBank && (
            <section className="dp-card">
              <header className="dp-card-head">
                <span className="dp-step">2</span>
                <h2>Bank Wire Instructions</h2>
              </header>
              <div className="dp-bank">
                <p className="dp-bank-intro">
                  A dedicated receiving account is assigned to each client. Your account number,
                  routing details and reference code are issued privately by our funding desk.
                </p>
                <div className="dp-bank-steps">
                  {[
                    { n: '01', t: 'Request details', d: 'Contact the funding desk to receive your personal wire credentials.' },
                    { n: '02', t: 'Initiate wire / ACH', d: 'Send funds from your bank using the provided account and routing numbers.' },
                    { n: '03', t: 'Funds credited', d: 'Wires are reflected within 1–2 business days after your bank processes them.' },
                  ].map(s => (
                    <div className="dp-bank-step" key={s.n}>
                      <span className="dp-bank-n">{s.n}</span>
                      <div>
                        <p className="dp-bank-t">{s.t}</p>
                        <p className="dp-bank-d">{s.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="dp-note">
                  <span>🔒</span>
                  <p>Bank details are never displayed here. Always verify you are speaking with an official Apex Markets agent.</p>
                </div>
                <Link to="/dashboard/support" className="dp-submit bank-link">Contact Funding Desk →</Link>
              </div>
            </section>
          )}

          {/* ── step 3 · confirm ── */}
          {active && !isBank && !submitted && (
            <section className="dp-card">
              <header className="dp-card-head">
                <span className="dp-step">3</span>
                <h2>Confirm Amount Sent</h2>
              </header>
              <div className="dp-confirm">
                <p className="dp-confirm-sub">
                  After sending, declare the USD value. The deposit is reviewed and credited within 1–24h.
                </p>
                <div className="dp-amount-row">
                  <span className="dp-cur">$</span>
                  <input
                    className="dp-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    min="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                  <span className="dp-unit">USD</span>
                </div>
                <div className="dp-quick">
                  {['100', '500', '1000', '5000'].map(q => (
                    <button key={q} className={`dp-quick-btn ${amount === q ? 'on' : ''}`} onClick={() => setAmount(q)}>
                      ${q}
                    </button>
                  ))}
                </div>
                {submitErr && <p className="dp-err">{submitErr}</p>}
                <button
                  className="dp-submit"
                  disabled={!amount || Number(amount) <= 0 || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'SUBMITTING…' : `CONFIRM $${amount || '0'} DEPOSIT`}
                </button>
              </div>
            </section>
          )}

          {/* ── success ── */}
          {submitted && !isBank && (
            <section className="dp-card">
              <div className="dp-success">
                <div className="dp-success-ico">✓</div>
                <p className="dp-success-title">Deposit Submitted</p>
                <p className="dp-success-sub">
                  <span className="amt">${fmt(Number(amount))}</span> via {active?.label} is under review.
                  Funds are credited within 1–24 hours.
                </p>
                <button className="dp-again" onClick={resetForm}>MAKE ANOTHER DEPOSIT</button>
              </div>
            </section>
          )}
        </div>

        {/* ══════════ SIDE RAIL ══════════ */}
        <aside className="dp-side">

          <section className="dp-card">
            <header className="dp-card-head">
              <h2>Deposit History</h2>
              <span className="dp-count">{history.length}</span>
            </header>
            {historyLoading ? (
              <div className="dp-center"><div className="dp-spinner small" /></div>
            ) : history.length === 0 ? (
              <div className="dp-empty">
                <p className="dp-empty-sub" style={{ padding: '6px 0 2px' }}>No deposits yet</p>
              </div>
            ) : (
              <div className="dp-hlist">
                {history.map(d => (
                  <div className="dp-hrow" key={d.id}>
                    <div className="dp-hmeta">
                      <p className="dp-hamt">${fmt(d.amount)} <span className="cur">{d.currency}</span></p>
                      <p className="dp-hsub">{d.methodLabel ? `${d.methodLabel} · ` : ''}{fmtDate(d.createdAt)}</p>
                    </div>
                    <StatusChip status={d.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dp-card dp-secure">
            <header className="dp-card-head">
              <h2>Before You Send</h2>
            </header>
            <ul className="dp-secure-list">
              <li>Verify the network matches your withdrawal source.</li>
              <li>Deposits are credited after 1 confirmation and review.</li>
              <li>Never share one-time codes with anyone — support will never ask.</li>
            </ul>
            <Link to="/dashboard/support" className="dp-secure-link">Questions? Open a ticket →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
