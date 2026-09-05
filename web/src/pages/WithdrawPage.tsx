import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './withdraw.css';

type WithdrawalMethod = {
  id: string;
  label: string;
  icon: string;
  logoUrl?: string;
  network?: string;
  note?: string;
};

type Withdrawal = {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING_VERIFICATION' | 'PENDING' | 'APPROVED' | 'REJECTED';
  methodLabel?: string;
  note?: string;
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

function StatusChip({ status }: { status: Withdrawal['status'] }) {
  const label = status === 'PENDING_VERIFICATION' ? 'VERIFYING' : status;
  return <span className={`wp-chip ${status.toLowerCase()}`}>{label}</span>;
}

export default function WithdrawPage() {
  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [methodsLoading, setML] = useState(true);
  const [selectedMethod, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [historyLoading, setHL] = useState(true);
  const [balance, setBalance] = useState(0);

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
      const res = await fetch('/api/user/withdrawals', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setHistory(d.withdrawals ?? []);
      }
    } finally { setHL(false); }
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/user/dashboard', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBalance(Number(data.user.portfolioBalance) || 0);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchMethods(); fetchHistory(); fetchBalance(); }, [fetchMethods, fetchHistory, fetchBalance]);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return setSubmitErr('Enter a valid amount');
    if (Number(amount) > balance) return setSubmitErr('Insufficient balance');
    if (!destination.trim()) return setSubmitErr('Enter destination address/account');

    setSubmitting(true);
    setSubmitErr('');
    try {
      const active = methods.find(m => m.id === selectedMethod);
      const res = await fetch('/api/user/withdrawals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          currency: 'USD',
          methodId: selectedMethod,
          methodLabel: active?.label,
          destination: destination.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitErr(d.error ?? 'Failed to submit withdrawal');
        return;
      }
      setSubmitted(true);
      fetchHistory();
      fetchBalance();
    } catch { setSubmitErr('Network error. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const resetForm = () => { setSubmitted(false); setAmount(''); setDestination(''); setSubmitErr(''); };

  const active = methods.find(m => m.id === selectedMethod);
  const pendingCount = history.filter(h => h.status === 'PENDING' || h.status === 'PENDING_VERIFICATION').length;
  const approvedTotal = history.filter(h => h.status === 'APPROVED').reduce((a, h) => a + Number(h.amount || 0), 0);

  const setPercentage = (pct: number) => setAmount((balance * pct).toFixed(2));

  return (
    <div className="wp-wrap">
      <div className="wp-head">
        <div>
          <p className="wp-eyebrow"><span className="wp-eyebrow-pip" />Apex · Mkts — Withdrawal</p>
          <h1 className="wp-title">Withdraw Funds</h1>
        </div>
        <div className="wp-head-stats">
          <div className="wp-hstat">
            <span className="k">Available</span>
            <span className="v">${fmt(balance, 0)}</span>
          </div>
          <div className="wp-hstat">
            <span className="k">Pending</span>
            <span className={`v ${pendingCount ? 'pending' : ''}`}>{pendingCount}</span>
          </div>
          <div className="wp-hstat">
            <span className="k">Withdrawn</span>
            <span className="v">${fmt(approvedTotal, 0)}</span>
          </div>
        </div>
      </div>

      <div className="wp-grid">
        <div className="wp-main">

          {/* step 1 · method */}
          <section className="wp-card">
            <header className="wp-card-head">
              <span className="wp-step">1</span>
              <h2>Select Method</h2>
            </header>
            {methodsLoading ? (
              <div className="wp-center"><div className="wp-spinner" /></div>
            ) : methods.length === 0 ? (
              <div className="wp-empty">
                <p className="wp-empty-ico">🔧</p>
                <p className="wp-empty-title">No withdrawal methods configured</p>
                <p className="wp-empty-sub">Please contact support.</p>
              </div>
            ) : (
              <div className="wp-methods">
                {methods.map(m => (
                  <button
                    key={m.id}
                    className={`wp-method ${selectedMethod === m.id ? 'on' : ''}`}
                    onClick={() => { setSelected(m.id); resetForm(); }}
                  >
                    <span className="wp-method-ico">
                      {m.logoUrl && (
                        <img src={m.logoUrl} alt=""
                          onError={e => e.currentTarget.parentElement?.classList.add('broken')} />
                      )}
                      <span className="wp-method-ico-fb">{m.icon}</span>
                    </span>
                    <span className="wp-method-lbl">{m.label}</span>
                    {m.network && <span className="wp-method-net">{m.network}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* step 2 · destination */}
          {active && (
            <section className="wp-card">
              <header className="wp-card-head">
                <span className="wp-step">2</span>
                <h2>Destination</h2>
              </header>
              <div className="wp-dest">
                <p className="wp-dest-lbl">
                  {active.label}{active.network ? ` · ${active.network}` : ''}
                </p>
                <input
                  className="wp-input"
                  type="text"
                  placeholder="Enter wallet address or bank account number"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                />
                <p className="wp-dest-hint">
                  Double-check the destination. Withdrawals to incorrect addresses cannot be reversed.
                </p>
              </div>
            </section>
          )}

          {/* step 3 · amount */}
          {active && !submitted && (
            <section className="wp-card">
              <header className="wp-card-head">
                <span className="wp-step">3</span>
                <h2>Amount</h2>
              </header>
              <div className="wp-amount">
                <div className="wp-amount-row">
                  <span className="wp-cur">$</span>
                  <input
                    className="wp-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    min="0"
                    max={balance}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                  <span className="wp-unit">USD</span>
                </div>
                <div className="wp-quick">
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <button key={pct} className={`wp-quick-btn ${amount === (balance * pct).toFixed(2) ? 'on' : ''}`} onClick={() => setPercentage(pct)}>
                      {pct * 100}%
                    </button>
                  ))}
                </div>
                {submitErr && <p className="wp-err">{submitErr}</p>}
                <button
                  className="wp-submit"
                  disabled={!amount || Number(amount) <= 0 || !destination.trim() || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'SUBMITTING…' : `WITHDRAW $${amount || '0'}`}
                </button>
              </div>
            </section>
          )}

          {/* success */}
          {submitted && (
            <section className="wp-card">
              <div className="wp-success">
                <div className="wp-success-ico">✓</div>
                <p className="wp-success-title">Withdrawal Submitted</p>
                <p className="wp-success-sub">
                  <span className="amt">${fmt(Number(amount))}</span> to {active?.label} is under review.
                  Withdrawals are processed within 1–3 business days.
                </p>
                <button className="wp-again" onClick={resetForm}>MAKE ANOTHER WITHDRAWAL</button>
              </div>
            </section>
          )}
        </div>

        <aside className="wp-side">
          <section className="wp-card">
            <header className="wp-card-head">
              <h2>Withdrawal History</h2>
              <span className="wp-count">{history.length}</span>
            </header>
            {historyLoading ? (
              <div className="wp-center"><div className="wp-spinner small" /></div>
            ) : history.length === 0 ? (
              <div className="wp-empty">
                <p className="wp-empty-sub" style={{ padding: '6px 0 2px' }}>No withdrawals yet</p>
              </div>
            ) : (
              <div className="wp-hlist">
                {history.map(w => (
                  <div className="wp-hrow" key={w.id}>
                    <div className="wp-hmeta">
                      <p className="wp-hamt">${fmt(w.amount)} <span className="cur">{w.currency}</span></p>
                      <p className="wp-hsub">{w.methodLabel ? `${w.methodLabel} · ` : ''}{fmtDate(w.createdAt)}</p>
                    </div>
                    <StatusChip status={w.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="wp-card wp-info">
            <header className="wp-card-head">
              <h2>Before You Withdraw</h2>
            </header>
            <ul className="wp-info-list">
              <li>Withdrawals are reviewed manually and processed within 1–3 business days.</li>
              <li>Crypto withdrawals are irreversible — verify addresses carefully.</li>
              <li>Minimum withdrawal: $50 USD.</li>
              <li>A 1% processing fee applies to all withdrawals.</li>
            </ul>
            <Link to="/dashboard/support" className="wp-info-link">Questions? Open a ticket →</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
