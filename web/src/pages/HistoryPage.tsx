import { useState, useEffect, useMemo, useCallback } from 'react';
import './history-page.css';

type EventKind = 'trade' | 'deposit' | 'withdrawal' | 'activity';
type Outcome = 'profit' | 'loss' | null;

type TimelineEvent = {
  id: string;
  kind: EventKind;
  title: string;
  description: string;
  amount: number | null;
  outcome: Outcome;
  status: string | null;
  createdAt: string;
};

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function groupByDate(events: TimelineEvent[]) {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const e of events) {
    const key = fmtDate(e.createdAt);
    (groups[key] ??= []).push(e);
  }
  return groups;
}
function parseTradeAsset(asset: string | null) {
  if (!asset) return { action: 'TRADE', symbol: 'USD' };
  const parts = asset.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) return { action: parts[0].toUpperCase(), symbol: parts[1].trim() };
  return { action: 'TRADE', symbol: asset };
}

/* ── inline icons ── */
const IcoRefresh = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const IcoSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
  </svg>
);
const IcoDownLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="17" y1="7" x2="7" y2="17" /><polyline points="17 17 7 17 7 7" />
  </svg>
);
const IcoUpRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
  </svg>
);
const IcoZap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const IcoActivity = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

export default function HistoryPage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EventKind | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const opts = { credentials: 'include' as const };
      const [dashRes, assetsRes, depRes, wdRes] = await Promise.all([
        fetch('/api/user/dashboard', opts).catch(() => null),
        fetch('/api/assets', opts).catch(() => null),
        fetch('/api/user/deposits', opts).catch(() => null),
        fetch('/api/user/withdrawals', opts).catch(() => null),
      ]);

      const out: TimelineEvent[] = [];

      /* trades */
      if (assetsRes?.ok) {
        const d = await assetsRes.json().catch(() => ({}));
        for (const t of d.trades ?? []) {
          const { action, symbol } = parseTradeAsset(t.asset);
          out.push({
            id: `t-${t.id}`,
            kind: 'trade',
            title: `${symbol} ${action === 'BUY' ? 'Buy' : action === 'SELL' ? 'Sell' : 'Trade'}`,
            description: `${action} ${symbol} · ${fmtUsd(Number(t.amount || 0))}`,
            amount: Number(t.amount || 0),
            outcome: null,
            status: t.status ?? null,
            createdAt: t.createdAt,
          });
        }
      }

      /* deposits */
      if (depRes?.ok) {
        const d = await depRes.json().catch(() => ({}));
        for (const dep of d.deposits ?? []) {
          out.push({
            id: `d-${dep.id}`,
            kind: 'deposit',
            title: dep.methodLabel ? `Deposit · ${dep.methodLabel}` : 'Deposit',
            description: `Deposit via ${dep.methodLabel ?? 'external transfer'}`,
            amount: Number(dep.amount || 0),
            outcome: null,
            status: dep.status ?? null,
            createdAt: dep.createdAt,
          });
        }
      }

      /* withdrawals */
      if (wdRes?.ok) {
        const d = await wdRes.json().catch(() => ({}));
        for (const w of d.withdrawals ?? []) {
          const bits = [w.methodLabel && `via ${w.methodLabel}`, w.destination && `to ${w.destination}`].filter(Boolean).join(' ');
          out.push({
            id: `w-${w.id}`,
            kind: 'withdrawal',
            title: 'Withdrawal',
            description: `Withdrawal ${bits || 'requested'}`,
            amount: Number(w.amount || 0),
            outcome: null,
            status: w.status ?? null,
            createdAt: w.createdAt,
          });
        }
      }

      /* activity logs */
      if (dashRes?.ok) {
        const d = await dashRes.json().catch(() => ({}));
        for (const a of d.activityLogs ?? []) {
          out.push({
            id: `a-${a.id}`,
            kind: 'activity',
            title: 'Account activity',
            description: a.description,
            amount: null,
            outcome: null,
            status: null,
            createdAt: a.createdAt,
          });
        }
      }

      out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      setEvents(out);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = events;
    if (filter !== 'all') list = list.filter(e => e.kind === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    }
    return list;
  }, [events, filter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const dateKeys = Object.keys(grouped);

  const stats = useMemo(() => ({
    trades: events.filter(e => e.kind === 'trade').length,
    totalIn: events.filter(e => e.kind === 'deposit').reduce((s, e) => s + (e.amount ?? 0), 0),
    totalOut: events.filter(e => e.kind === 'withdrawal').reduce((s, e) => s + (e.amount ?? 0), 0),
  }), [events]);

  if (loading) {
    return (
      <div className="hy-wrap">
        <div className="hy-inner">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="hy-skeleton" style={{ height: 64 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hy-wrap">
      <div className="hy-inner">

        {/* header */}
        <div className="hy-head">
          <div>
            <p className="hy-eyebrow"><span className="hy-eyebrow-pip" />Apex · Mkts — Ledger</p>
            <h1 className="hy-title">History</h1>
            <p className="hy-sub">{events.length} EVENTS TOTAL</p>
          </div>
          <button className="hy-refresh" onClick={() => load(true)} disabled={refreshing} aria-label="Refresh">
            <IcoRefresh />
          </button>
        </div>

        {/* stat strip */}
        <section className="hy-card hy-strip">
          <div className="hy-strip-cell">
            <p className="hy-strip-lbl">Trades</p>
            <p className="hy-strip-val pos">{stats.trades}</p>
          </div>
          <div className="hy-strip-cell">
            <p className="hy-strip-lbl">Deposited</p>
            <p className="hy-strip-val acc">{fmtUsd(stats.totalIn)}</p>
          </div>
          <div className="hy-strip-cell">
            <p className="hy-strip-lbl">Withdrawn</p>
            <p className="hy-strip-val gold">{fmtUsd(stats.totalOut)}</p>
          </div>
        </section>

        {/* controls */}
        <div className="hy-controls">
          <div className="hy-search">
            <IcoSearch />
            <input placeholder="Search history…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="hy-filters">
            {([
              { key: 'all', label: 'All' },
              { key: 'trade', label: 'Trades' },
              { key: 'deposit', label: 'Deposits' },
              { key: 'withdrawal', label: 'Withdrawals' },
              { key: 'activity', label: 'Activity' },
            ] as const).map(f => (
              <button
                key={f.key}
                className={`hy-filter ${filter === f.key ? `on-${f.key}` : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* timeline */}
        {dateKeys.length === 0 ? (
          <div className="hy-empty">
            <IcoActivity />
            <p>{search ? `No results for “${search}”` : 'No history yet.'}</p>
          </div>
        ) : dateKeys.map(dateKey => (
          <div key={dateKey} className="hy-card hy-group">
            <div className="hy-date">{dateKey}</div>
            {grouped[dateKey].map(event => {
              const isWithdrawal = event.kind === 'withdrawal';
              const isExpanded = expandedId === event.id;
              const badge =
                event.kind === 'deposit' ? 'dep'
                : event.kind === 'withdrawal' ? 'wd'
                : event.kind === 'trade' ? 'trade' : 'act';
              const amountClass =
                event.kind === 'deposit' ? 'acc'
                : event.kind === 'withdrawal' ? 'gold'
                : event.kind === 'trade' ? (event.outcome === 'loss' ? 'neg' : 'pos') : 'plain';

              return (
                <div key={event.id}>
                  <div
                    className="hy-row"
                    onClick={isWithdrawal ? () => setExpandedId(isExpanded ? null : event.id) : undefined}
                    style={isWithdrawal ? { cursor: 'pointer' } : undefined}
                  >
                    <div className={`hy-ico ${badge}`}>
                      {event.kind === 'deposit' && <IcoDownLeft />}
                      {event.kind === 'withdrawal' && <IcoUpRight />}
                      {event.kind === 'trade' && <IcoZap />}
                      {event.kind === 'activity' && <IcoActivity />}
                    </div>
                    <div className="hy-main">
                      <div className="hy-line1">
                        <span className="hy-title">{event.title}</span>
                        <span className={`hy-kind ${badge}`}>{event.kind}</span>
                      </div>
                      <div className="hy-line2">
                        {isWithdrawal ? (
                          <span className="hy-hint">{isExpanded ? 'Tap to hide details' : 'Tap to view details'}</span>
                        ) : (
                          <span className="hy-desc">{event.description}</span>
                        )}
                        <span className="hy-time">{fmtTime(event.createdAt)}</span>
                      </div>
                    </div>
                    <div className="hy-amt-col">
                      {event.amount !== null && (
                        <span className={`hy-amt ${amountClass}`}>
                          {event.kind === 'deposit' ? '+' : event.kind === 'withdrawal' ? '-' : ''}{fmtUsd(event.amount)}
                        </span>
                      )}
                      {event.status && <span className={`hy-status ${event.status.toLowerCase()}`}>{event.status.replace('_', ' ')}</span>}
                    </div>
                  </div>
                  {isWithdrawal && isExpanded && (
                    <div className="hy-expand">
                      <p>{event.description}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
