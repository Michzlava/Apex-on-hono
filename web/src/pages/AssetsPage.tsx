import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, RefreshCw, ChevronRight,
  BarChart2, Clock, Layers,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Position = {
  id: string;
  asset: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPnl: number;
  side: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
};

type Trade = {
  id: string;
  asset: string | null;
  action: string | null;
  amount: number;
  status: string;
  createdAt: string;
};

type AssetsData = {
  portfolioBalance: number;
  realisedPnl: number;
  positions: Position[];
  trades: Trade[];
};

// ── Asset meta ────────────────────────────────────────────────────────────────

const ASSET_META: Record<string, { label: string; bg: string; col: string; icon: string; img?: string }> = {
  BTC:    { label: 'Bitcoin',     bg: '#f7931a22', col: '#f7931a', icon: '₿', img: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  ETH:    { label: 'Ethereum',    bg: '#627eea22', col: '#627eea', icon: 'Ξ', img: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  SOL:    { label: 'Solana',      bg: '#9945ff22', col: '#9945ff', icon: '◎', img: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  BNB:    { label: 'BNB',         bg: '#f3ba2f22', col: '#f3ba2f', icon: 'B', img: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  AAPL:   { label: 'Apple',       bg: '#aaaaaa22', col: '#aaaaaa', icon: '', img: 'https://img.logo.dev/apple.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  TSLA:   { label: 'Tesla',       bg: '#e3193722', col: '#e31937', icon: 'T', img: 'https://img.logo.dev/tesla.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  NVDA:   { label: 'NVIDIA',      bg: '#76b90022', col: '#76b900', icon: 'N', img: 'https://img.logo.dev/nvidia.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  MSFT:   { label: 'Microsoft',   bg: '#00a4ef22', col: '#00a4ef', icon: 'M', img: 'https://img.logo.dev/microsoft.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  AMZN:   { label: 'Amazon',      bg: '#ff990022', col: '#ff9900', icon: 'A', img: 'https://img.logo.dev/amazon.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  GOOGL:  { label: 'Alphabet',    bg: '#4285f422', col: '#4285f4', icon: 'G', img: 'https://img.logo.dev/google.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  USOIL:  { label: 'WTI Crude',   bg: '#64748b22', col: '#94a3b8', icon: '🛢' },
  UKOIL:  { label: 'Brent Crude', bg: '#64748b22', col: '#94a3b8', icon: '🛢' },
  XAUUSD: { label: 'Gold',        bg: '#eab30822', col: '#eab308', icon: '🥇' },
  EURUSD: { label: 'EUR/USD',     bg: '#00c9b122', col: '#00c9b1', icon: '€' },
  GBPUSD: { label: 'GBP/USD',     bg: '#00c9b122', col: '#00c9b1', icon: '£' },
  USDJPY: { label: 'USD/JPY',     bg: '#00c9b122', col: '#00c9b1', icon: '¥' },
  USD:    { label: 'US Dollar',   bg: '#22c55e22', col: '#22c55e', icon: '$' },
};

const PRICE_SYMBOL_MAP: Record<string, string> = {
  USOIL: 'USOIL', UKOIL: 'UKOIL', XAUUSD: 'XAUUSD',
  EURUSD: 'EURUSD', GBPUSD: 'GBPUSD', USDJPY: 'USDJPY',
};

function getMeta(symbol: string) {
  return ASSET_META[symbol] ?? { label: symbol, bg: '#ffffff11', col: '#94a3b8', icon: '?' };
}

function tradeSymbol(trade: Trade): string {
  if (!trade.asset) return 'USD';
  const parts = trade.asset.split(':');
  const sym   = parts[1]?.trim();
  return sym && sym.length > 0 ? sym : 'USD';
}

function fmtUsd(n: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtQty(n: number) {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1)    return n.toFixed(4);
  return n.toFixed(6);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [data, setData]               = useState<AssetsData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [livePrices, setLivePrices]   = useState<Record<string, number>>({});
  const [tab, setTab]                 = useState<'open' | 'closed' | 'history'>('open');

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/assets', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const json: AssetsData = await res.json();
      setData(json);
      fetchLivePrices(json.positions);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  const fetchLivePrices = async (positions: Position[]) => {
    const openSymbols = Array.from(new Set(
      positions.filter(p => p.status === 'OPEN').map(p => p.symbol)
    ));
    for (const sym of openSymbols) {
      const apiSym = PRICE_SYMBOL_MAP[sym] ?? sym.replace('USD', '');
      try {
        const res = await fetch(`/api/price?symbol=${apiSym}`, { credentials: 'include' });
        const d   = await res.json();
        if (d.price) setLivePrices(prev => ({ ...prev, [sym]: d.price }));
      } catch {}
    }
  };

  const openPositions   = useMemo(() => data?.positions.filter(p => p.status === 'OPEN')   ?? [], [data]);
  const closedPositions = useMemo(() => data?.positions.filter(p => p.status === 'CLOSED') ?? [], [data]);

  const unrealisedPnl = useMemo(() =>
    openPositions.reduce((sum, p) => {
      const current = livePrices[p.symbol] ?? 0;
      if (!current) return sum + p.currentPnl;
      const dir = p.side === 'SHORT' ? -1 : 1;
      return sum + dir * (current - p.entryPrice) * p.quantity;
    }, 0),
  [openPositions, livePrices]);

  // ── Sub-components ────────────────────────────────────────────────────────

  const PnlChip = ({ value }: { value: number }) => (
    <span style={{
      color:      value >= 0 ? 'var(--green)' : 'var(--red)',
      background: value >= 0 ? 'var(--green-l)' : 'var(--red-l)',
      border:     `1px solid ${value >= 0 ? 'var(--green)' : 'var(--red)'}`,
      opacity: 0.9, borderRadius: 6, padding: '2px 8px',
      fontFamily: 'var(--mono)', fontSize: '0.68rem', fontWeight: 700,
      maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis',
      whiteSpace: 'nowrap', display: 'inline-block', flexShrink: 0,
    }}>
      {value >= 0 ? '+' : ''}{fmtUsd(value)}
    </span>
  );

  const EmptyState = ({ message, cta }: { message: string; cta?: boolean }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 12, padding: '48px 24px', color: 'var(--ink-faint)',
    }}>
      <BarChart2 size={32} strokeWidth={1.2} color="var(--ink-faint)" />
      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', letterSpacing: '0.06em', textAlign: 'center', color: 'var(--ink-faint)' }}>
        {message}
      </p>
      {cta && (
        <Link to="/dashboard/trade" style={{
          background: 'var(--accent)', color: '#0a1f2e',
          borderRadius: 8, padding: '9px 20px',
          fontFamily: 'var(--mono)', fontSize: '0.7rem', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(56,189,248,0.2)',
        }}>
          Start Trading
        </Link>
      )}
    </div>
  );

  function AssetIcon({ symbol, size = 38 }: { symbol: string; size?: number }) {
    const meta = getMeta(symbol);
    return (
      <div style={{
        width: size, height: size, borderRadius: 10, flexShrink: 0,
        background: meta.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.45, color: meta.col,
        fontWeight: 700, overflow: 'hidden',
      }}>
        {meta.img
          ? <img src={meta.img} alt={symbol}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          : <span style={{ fontSize: size > 30 ? '1.1rem' : '0.75rem' }}>{meta.icon}</span>
        }
      </div>
    );
  }

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={{ ...styles.skeletonBox, width: 140, height: 20 }} />
            <div style={{ ...styles.skeletonBox, width: 80, height: 13, marginTop: 6 }} />
          </div>
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ ...styles.card, height: 72, ...styles.skeletonBox }} />
        ))}
      </div>
    </div>
  );

  const totalPnl = (data?.realisedPnl ?? 0) + unrealisedPnl;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); font-family: var(--sans); color: var(--ink); }

        .tab-btn {
          background: none; border: none; cursor: pointer;
          font-family: var(--mono); font-size: 0.65rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--ink-faint); padding: 8px 14px; border-radius: 8px;
          transition: all 0.15s; white-space: nowrap;
        }
        .tab-btn:hover { color: var(--ink-dim); }
        .tab-btn.active {
          background: var(--accent-l); color: var(--accent);
          border: 1px solid var(--accent); opacity: 0.9;
        }

        .pos-row {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-bottom: 1px solid var(--line);
          transition: background 0.15s; overflow: hidden; min-width: 0;
        }
        .pos-row:last-child { border-bottom: none; }
        .pos-row:hover { background: var(--surface-hover); }

        .trade-thead {
          display: grid;
          grid-template-columns: 2fr 1.4fr 1.2fr 1.4fr;
          padding: 10px 16px;
          border-bottom: 1px solid var(--line-strong);
          background: var(--bg);
        }
        .trade-row {
          display: grid;
          grid-template-columns: 2fr 1.4fr 1.2fr 1.4fr;
          align-items: center;
          padding: 12px 16px; border-bottom: 1px solid var(--line);
          transition: background 0.15s;
        }
        .trade-row:last-child { border-bottom: none; }
        .trade-row:hover { background: var(--surface-hover); }
        .trade-th {
          font-family: var(--mono); font-size: 0.58rem;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--ink-faint);
        }

        .refresh-btn {
          background: none; border: 1px solid var(--line-strong);
          border-radius: 8px; padding: 8px 10px; cursor: pointer;
          color: var(--ink-faint); transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .refresh-btn:hover { color: var(--ink-dim); }

        .side-badge-long {
          font-family: var(--mono); font-size: 0.58rem; font-weight: 700;
          padding: 1px 6px; border-radius: 4px;
          background: var(--green-l); color: var(--green);
          border: 1px solid var(--green); opacity: 0.85;
        }
        .side-badge-short {
          font-family: var(--mono); font-size: 0.58rem; font-weight: 700;
          padding: 1px 6px; border-radius: 4px;
          background: var(--red-l); color: var(--red);
          border: 1px solid var(--red); opacity: 0.85;
        }
        .side-badge-closed {
          font-family: var(--mono); font-size: 0.58rem; font-weight: 700;
          padding: 1px 6px; border-radius: 4px;
          background: var(--surface); color: var(--ink-faint);
          border: 1px solid var(--line-strong);
        }
        .status-ok {
          font-family: var(--mono); font-size: 0.58rem; font-weight: 700;
          padding: 2px 7px; border-radius: 4px;
          background: var(--green-l); color: var(--green);
          border: 1px solid var(--green); opacity: 0.85;
        }
        .status-fail {
          font-family: var(--mono); font-size: 0.58rem; font-weight: 700;
          padding: 2px 7px; border-radius: 4px;
          background: var(--red-l); color: var(--red);
          border: 1px solid var(--red); opacity: 0.85;
        }

        .action-link {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 11px 8px; border-radius: 10px; text-decoration: none;
          background: var(--card); border: 1px solid var(--line-strong);
          transition: background 0.15s, border-color 0.15s;
        }
        .action-link:hover { background: var(--surface-hover); }

        @media (min-width: 700px) {
          .as-hero-row {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .as-summary-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .trade-thead,
          .trade-row {
            padding-left: 20px;
            padding-right: 20px;
          }
        }

        @keyframes shimmer { to { background-position: -200% 0; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
      `}</style>

      <div style={styles.page}>
        <div style={styles.inner}>

          {/* ── HEADER ── */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <h1 style={styles.pageTitle}>My Assets</h1>
              <p style={styles.pageSub}>
                {openPositions.length} open · {closedPositions.length} closed · {data?.trades.length ?? 0} trades
              </p>
            </div>
            <button
              className="refresh-btn"
              onClick={() => loadData(true)}
              disabled={refreshing}
              style={{ color: refreshing ? 'var(--accent)' : undefined }}
            >
              <RefreshCw size={15} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            </button>
          </div>

          {/* ── HERO + STATS ── */}
          <div className="as-hero-row" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            <div style={{ ...styles.card, padding: '20px 20px 18px', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 160, height: 160,
                background: 'radial-gradient(circle, var(--accent-l) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />
              <span style={{
                fontFamily: 'var(--mono)', fontSize: '0.58rem',
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--ink-faint)', display: 'block', marginBottom: 6,
              }}>
                Portfolio Balance
              </span>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: '1.9rem',
                fontWeight: 700, color: 'var(--ink)', display: 'block', letterSpacing: '-0.01em',
              }}>
                {fmtUsd(data?.portfolioBalance ?? 0)}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                {totalPnl >= 0
                  ? <TrendingUp size={13} color="var(--green)" />
                  : <TrendingDown size={13} color="var(--red)" />
                }
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: '0.72rem', fontWeight: 700,
                  color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {totalPnl >= 0 ? '+' : ''}{fmtUsd(totalPnl)}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--ink-faint)' }}>
                  total P&L
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="as-summary-grid" style={styles.summaryGrid}>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Unrealised P&L</span>
                  <span style={{ ...styles.summaryValue, color: unrealisedPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {unrealisedPnl >= 0 ? '+' : ''}{fmtUsd(unrealisedPnl)}
                  </span>
                </div>
                <div style={styles.summaryCard}>
                  <span style={styles.summaryLabel}>Realised P&L</span>
                  <span style={{ ...styles.summaryValue, color: (data?.realisedPnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {(data?.realisedPnl ?? 0) >= 0 ? '+' : ''}{fmtUsd(data?.realisedPnl ?? 0)}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
                {[
                  { to: '/dashboard/deposit',  label: 'Deposit',  color: 'var(--green)'  },
                  { to: '/dashboard/withdraw', label: 'Withdraw', color: 'var(--red)'    },
                  { to: '/dashboard/history',  label: 'History',  color: 'var(--accent)' },
                ].map(({ to, label, color }) => (
                  <Link key={to} to={to} className="action-link">
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: '0.62rem', fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase' as const, color,
                    }}>
                      {label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── TABS ── */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
            {([
              { key: 'open',    label: 'Open',    icon: <Layers size={12} /> },
              { key: 'closed',  label: 'Closed',  icon: <BarChart2 size={12} /> },
              { key: 'history', label: 'History', icon: <Clock size={12} /> },
            ] as const).map(t => (
              <button
                key={t.key}
                className={`tab-btn${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {t.icon} {t.label}
                  {t.key === 'open' && openPositions.length > 0 && (
                    <span style={{
                      background: 'var(--accent)', color: '#0a1f2e',
                      borderRadius: 999, padding: '1px 6px',
                      fontSize: '0.55rem', fontWeight: 700,
                    }}>
                      {openPositions.length}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* ── OPEN POSITIONS ── */}
          {tab === 'open' && (
            <div style={styles.card}>
              {openPositions.length === 0
                ? <EmptyState message="No open positions. Place a trade to get started." cta />
                : openPositions.map(pos => {
                    const current = livePrices[pos.symbol] ?? 0;
                    const dir     = pos.side === 'SHORT' ? -1 : 1;
                    const livePnl = current
                      ? dir * (current - pos.entryPrice) * pos.quantity
                      : pos.currentPnl;
                    const pnlPct  = pos.entryPrice > 0
                      ? (livePnl / (pos.entryPrice * pos.quantity)) * 100
                      : 0;

                    return (
                      <div className="pos-row" key={pos.id}>
                        <AssetIcon symbol={pos.symbol} size={38} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>{pos.symbol}</span>
                            <span className={pos.side === 'LONG' ? 'side-badge-long' : 'side-badge-short'}>
                              {pos.side}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--ink-faint)' }}>
                              Qty: {fmtQty(pos.quantity)}
                            </span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--ink-faint)' }}>
                              Entry: {fmtUsd(pos.entryPrice)}
                            </span>
                            {current > 0 && (
                              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--ink-dim)' }}>
                                Now: {fmtUsd(current)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                          <PnlChip value={livePnl} />
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                          </span>
                        </div>
                        <Link to={`/dashboard/trade?asset=${pos.symbol}`} style={{ color: 'var(--ink-faint)', flexShrink: 0 }}>
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    );
                  })
              }
            </div>
          )}

          {/* ── CLOSED POSITIONS ── */}
          {tab === 'closed' && (
            <div style={styles.card}>
              {closedPositions.length === 0
                ? <EmptyState message="No closed positions yet." />
                : closedPositions.map(pos => (
                    <div className="pos-row" key={pos.id}>
                      <AssetIcon symbol={pos.symbol} size={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>{pos.symbol}</span>
                          <span className="side-badge-closed">{pos.side}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--ink-faint)' }}>
                            Entry: {fmtUsd(pos.entryPrice)}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--ink-faint)' }}>
                            Closed: {fmtDate(pos.closedAt ?? pos.openedAt)}
                          </span>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <PnlChip value={pos.currentPnl} />
                      </div>
                    </div>
                  ))
              }
            </div>
          )}

          {/* ── TRADE HISTORY ── */}
          {tab === 'history' && (
            <div style={styles.card}>
              <div className="trade-thead">
                <span className="trade-th">Asset</span>
                <span className="trade-th">Amount</span>
                <span className="trade-th">Status</span>
                <span className="trade-th">Date</span>
              </div>

              {(data?.trades.length ?? 0) === 0
                ? <EmptyState message="No trade history yet." cta />
                : data?.trades.map(t => {
                    const sym = tradeSymbol(t);
                    const ok  = t.status === 'COMPLETED';
                    return (
                      <div className="trade-row" key={t.id}>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <AssetIcon symbol={sym} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{
                              fontFamily: 'var(--mono)', fontSize: '0.72rem', fontWeight: 700,
                              color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {sym}
                            </p>
                            <p style={{ fontFamily: 'var(--mono)', fontSize: '0.58rem', color: 'var(--ink-faint)' }}>
                              {fmtTime(t.createdAt)}
                            </p>
                          </div>
                        </div>

                        <span style={{
                          fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--ink)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {fmtUsd(t.amount)}
                        </span>

                        <span className={ok ? 'status-ok' : 'status-fail'}>
                          {t.status}
                        </span>

                        <span style={{ fontFamily: 'var(--mono)', fontSize: '0.62rem', color: 'var(--ink-dim)' }}>
                          {fmtDate(t.createdAt)}
                        </span>

                      </div>
                    );
                  })
              }
            </div>
          )}

          <div style={{ height: 80 }} />
        </div>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    padding: '20px 16px',
  },
  inner: {
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 4,
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
  pageTitle: {
    fontFamily: 'var(--sans)', fontSize: '1.45rem',
    fontWeight: 700, color: 'var(--ink)',
  },
  pageSub: {
    fontFamily: 'var(--mono)', fontSize: '0.62rem',
    color: 'var(--ink-faint)', letterSpacing: '0.08em',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  summaryCard: {
    background: 'var(--card)', border: '1px solid var(--line-strong)',
    borderRadius: 12, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden',
  },
  summaryLabel: {
    fontFamily: 'var(--mono)', fontSize: '0.55rem',
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    color: 'var(--ink-faint)',
  },
  summaryValue: {
    fontFamily: 'var(--mono)', fontSize: '0.82rem',
    fontWeight: 700, color: 'var(--ink)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  card: {
    background: 'var(--card)', border: '1px solid var(--line-strong)',
    borderRadius: 14, overflow: 'hidden',
  },
  skeletonBox: {
    background: 'linear-gradient(90deg, var(--bg-3) 25%, var(--card) 50%, var(--bg-3) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: 10,
  },
};
