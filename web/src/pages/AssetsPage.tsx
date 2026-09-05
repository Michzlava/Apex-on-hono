import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './assets-page.css';

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

const ASSET_META: Record<string, { label: string; icon: string; img?: string }> = {
  BTC:    { label: 'Bitcoin',     icon: '₿', img: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  ETH:    { label: 'Ethereum',    icon: 'Ξ', img: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  SOL:    { label: 'Solana',      icon: '◎', img: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  BNB:    { label: 'BNB',         icon: 'B', img: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  AAPL:   { label: 'Apple',       icon: '', img: 'https://img.logo.dev/apple.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  TSLA:   { label: 'Tesla',       icon: 'T', img: 'https://img.logo.dev/tesla.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  NVDA:   { label: 'NVIDIA',      icon: 'N', img: 'https://img.logo.dev/nvidia.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  MSFT:   { label: 'Microsoft',   icon: 'M', img: 'https://img.logo.dev/microsoft.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  AMZN:   { label: 'Amazon',      icon: 'A', img: 'https://img.logo.dev/amazon.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  GOOGL:  { label: 'Alphabet',    icon: 'G', img: 'https://img.logo.dev/google.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  USOIL:  { label: 'WTI Crude',   icon: '🛢' },
  UKOIL:  { label: 'Brent Crude', icon: '🛢' },
  XAUUSD: { label: 'Gold',        icon: '🥇' },
  EURUSD: { label: 'EUR/USD',     icon: '€' },
  GBPUSD: { label: 'GBP/USD',     icon: '£' },
  USDJPY: { label: 'USD/JPY',     icon: '¥' },
  USD:    { label: 'US Dollar',   icon: '$' },
};

const PRICE_SYMBOL_MAP: Record<string, string> = {
  USOIL: 'USOIL', UKOIL: 'UKOIL', XAUUSD: 'XAUUSD',
  EURUSD: 'EURUSD', GBPUSD: 'GBPUSD', USDJPY: 'USDJPY',
};

function getMeta(symbol: string) {
  return ASSET_META[symbol] ?? { label: symbol, icon: '?' };
}

function tradeSymbol(trade: Trade): string {
  if (!trade.asset) return 'USD';
  const parts = trade.asset.split(':');
  const sym = parts[1]?.trim();
  return sym && sym.length > 0 ? sym : 'USD';
}

function fmtUsd(n: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtQty(n: number) {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

export default function AssetsPage() {
  const [data, setData] = useState<AssetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<'open' | 'closed' | 'history'>('open');

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/assets', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const json: AssetsData = await res.json();
      setData(json);
      fetchLivePrices(json.positions);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const fetchLivePrices = async (positions: Position[]) => {
    const openSymbols = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
    for (const sym of openSymbols) {
      const apiSym = PRICE_SYMBOL_MAP[sym] ?? sym.replace('USD', '');
      try {
        const res = await fetch(`/api/price?symbol=${apiSym}`, { credentials: 'include' });
        const d = await res.json();
        if (d.price) setLivePrices(prev => ({ ...prev, [sym]: d.price }));
      } catch {
      }
    }
  };

  const openPositions = useMemo(() => data?.positions.filter(p => p.status === 'OPEN') ?? [], [data]);
  const closedPositions = useMemo(() => data?.positions.filter(p => p.status === 'CLOSED') ?? [], [data]);

  const unrealisedPnl = useMemo(() =>
    openPositions.reduce((sum, p) => {
      const current = livePrices[p.symbol] ?? 0;
      if (!current) return sum + p.currentPnl;
      const dir = p.side === 'SHORT' ? -1 : 1;
      return sum + dir * (current - p.entryPrice) * p.quantity;
    }, 0),
    [openPositions, livePrices]
  );

  const totalPnl = (data?.realisedPnl ?? 0) + unrealisedPnl;

  if (loading) {
    return (
      <div className="ap-wrap">
        <div className="ap-inner">
          <div className="ap-head">
            <div className="ap-skeleton" style={{ width: 140, height: 20 }} />
            <div className="ap-skeleton" style={{ width: 80, height: 13, marginTop: 6 }} />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="ap-card ap-skeleton" style={{ height: 72 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ap-wrap">
      <div className="ap-inner">

        {/* ══ HEADER ══ */}
        <div className="ap-head">
          <div>
            <p className="ap-eyebrow">
              <span className="ap-eyebrow-pip" />
              Apex · Mkts — Portfolio
            </p>
            <h1 className="ap-title">My Assets</h1>
            <p className="ap-sub">
              {openPositions.length} open · {closedPositions.length} closed · {data?.trades.length ?? 0} trades
            </p>
          </div>
          <button className="ap-refresh" onClick={() => loadData(true)} disabled={refreshing}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        {/* ══ PORTFOLIO HERO ══ */}
        <section className="ap-card ap-hero">
          <div className="ap-hero-glow" />
          <div className="ap-hero-content">
            <p className="ap-hero-eyebrow">Portfolio Balance</p>
            <p className="ap-hero-balance">{fmtUsd(data?.portfolioBalance ?? 0)}</p>
            <div className="ap-hero-pnl">
              <span className={`ap-trend ${totalPnl >= 0 ? 'up' : 'down'}`}>
                {totalPnl >= 0 ? '▲' : '▼'}
              </span>
              <span className={`ap-hero-pnl-val ${totalPnl >= 0 ? 'pos' : 'neg'}`}>
                {totalPnl >= 0 ? '+' : ''}{fmtUsd(totalPnl)}
              </span>
              <span className="ap-hero-pnl-sub">total P&L</span>
            </div>
          </div>
        </section>

        {/* ══ STATS ROW ══ */}
        <div className="ap-stats">
          <div className="ap-stat">
            <p className="ap-stat-lbl">Unrealised P&L</p>
            <p className={`ap-stat-val ${unrealisedPnl >= 0 ? 'pos' : 'neg'}`}>
              {unrealisedPnl >= 0 ? '+' : ''}{fmtUsd(unrealisedPnl)}
            </p>
          </div>
          <div className="ap-stat">
            <p className="ap-stat-lbl">Realised P&L</p>
            <p className={`ap-stat-val ${(data?.realisedPnl ?? 0) >= 0 ? 'pos' : 'neg'}`}>
              {(data?.realisedPnl ?? 0) >= 0 ? '+' : ''}{fmtUsd(data?.realisedPnl ?? 0)}
            </p>
          </div>
        </div>

        {/* ══ QUICK ACTIONS ══ */}
        <div className="ap-actions">
          <Link to="/dashboard/deposit" className="ap-action">
            <span className="ap-action-lbl pos">＋ Deposit</span>
          </Link>
          <Link to="/dashboard/withdraw" className="ap-action">
            <span className="ap-action-lbl neg">↑ Withdraw</span>
          </Link>
          <Link to="/dashboard/trade" className="ap-action">
            <span className="ap-action-lbl acc">⇄ Trade</span>
          </Link>
        </div>

        {/* ══ TABS ══ */}
        <div className="ap-tabs">
          {([
            { key: 'open', label: 'Open Positions', count: openPositions.length },
            { key: 'closed', label: 'Closed', count: closedPositions.length },
            { key: 'history', label: 'Trade History', count: data?.trades.length ?? 0 },
          ] as const).map(t => (
            <button
              key={t.key}
              className={`ap-tab ${tab === t.key ? 'on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span>{t.label}</span>
              {t.count > 0 && <span className="ap-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* ══ OPEN POSITIONS ══ */}
        {tab === 'open' && (
          <section className="ap-card">
            {openPositions.length === 0 ? (
              <div className="ap-empty">
                <p className="ap-empty-ico">📊</p>
                <p className="ap-empty-title">No open positions</p>
                <p className="ap-empty-sub">Place a trade to get started.</p>
                <Link to="/dashboard/trade" className="ap-empty-cta">Start Trading →</Link>
              </div>
            ) : (
              <div className="ap-positions">
                {openPositions.map(pos => {
                  const current = livePrices[pos.symbol] ?? 0;
                  const dir = pos.side === 'SHORT' ? -1 : 1;
                  const livePnl = current ? dir * (current - pos.entryPrice) * pos.quantity : pos.currentPnl;
                  const pnlPct = pos.entryPrice > 0 ? (livePnl / (pos.entryPrice * pos.quantity)) * 100 : 0;
                  const meta = getMeta(pos.symbol);

                  return (
                    <Link to={`/dashboard/trade?asset=${pos.symbol}`} key={pos.id} className="ap-pos">
                      <div className="ap-pos-ico">
                        {meta.img ? (
                          <img src={meta.img} alt={pos.symbol} onError={e => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('ap-pos-ico-fb-hide');
                          }} />
                        ) : null}
                        <span className="ap-pos-ico-fb">{meta.icon}</span>
                      </div>
                      <div className="ap-pos-meta">
                        <div className="ap-pos-head">
                          <span className="ap-pos-sym">{pos.symbol}</span>
                          <span className={`ap-pos-side ${pos.side === 'LONG' ? 'long' : 'short'}`}>{pos.side}</span>
                        </div>
                        <div className="ap-pos-details">
                          <span>Qty: {fmtQty(pos.quantity)}</span>
                          <span>Entry: {fmtUsd(pos.entryPrice)}</span>
                          {current > 0 && <span>Now: {fmtUsd(current)}</span>}
                        </div>
                      </div>
                      <div className="ap-pos-pnl">
                        <span className={`ap-pos-pnl-val ${livePnl >= 0 ? 'pos' : 'neg'}`}>
                          {livePnl >= 0 ? '+' : ''}{fmtUsd(livePnl)}
                        </span>
                        <span className={`ap-pos-pnl-pct ${pnlPct >= 0 ? 'pos' : 'neg'}`}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </span>
                      </div>
                      <span className="ap-pos-arrow">→</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ══ CLOSED POSITIONS ══ */}
        {tab === 'closed' && (
          <section className="ap-card">
            {closedPositions.length === 0 ? (
              <div className="ap-empty">
                <p className="ap-empty-ico">📉</p>
                <p className="ap-empty-title">No closed positions</p>
                <p className="ap-empty-sub">Your trade history will appear here.</p>
              </div>
            ) : (
              <div className="ap-positions">
                {closedPositions.map(pos => {
                  const meta = getMeta(pos.symbol);
                  return (
                    <div key={pos.id} className="ap-pos closed">
                      <div className="ap-pos-ico">
                        {meta.img ? (
                          <img src={meta.img} alt={pos.symbol} onError={e => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('ap-pos-ico-fb-hide');
                          }} />
                        ) : null}
                        <span className="ap-pos-ico-fb">{meta.icon}</span>
                      </div>
                      <div className="ap-pos-meta">
                        <div className="ap-pos-head">
                          <span className="ap-pos-sym">{pos.symbol}</span>
                          <span className="ap-pos-side closed">{pos.side}</span>
                        </div>
                        <div className="ap-pos-details">
                          <span>Entry: {fmtUsd(pos.entryPrice)}</span>
                          <span>Closed: {fmtDate(pos.closedAt ?? pos.openedAt)}</span>
                        </div>
                      </div>
                      <div className="ap-pos-pnl">
                        <span className={`ap-pos-pnl-val ${pos.currentPnl >= 0 ? 'pos' : 'neg'}`}>
                          {pos.currentPnl >= 0 ? '+' : ''}{fmtUsd(pos.currentPnl)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ══ TRADE HISTORY ══ */}
        {tab === 'history' && (
          <section className="ap-card">
            {(data?.trades.length ?? 0) === 0 ? (
              <div className="ap-empty">
                <p className="ap-empty-ico">⏱</p>
                <p className="ap-empty-title">No trade history</p>
                <p className="ap-empty-sub">Your completed trades will appear here.</p>
                <Link to="/dashboard/trade" className="ap-empty-cta">Start Trading →</Link>
              </div>
            ) : (
              <>
                <div className="ap-table-head">
                  <span>Asset</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Date</span>
                </div>
                <div className="ap-table">
                  {data?.trades.map(t => {
                    const sym = tradeSymbol(t);
                    const ok = t.status === 'COMPLETED';
                    const meta = getMeta(sym);

                    return (
                      <div key={t.id} className="ap-table-row">
                        <div className="ap-table-cell ap-table-asset">
                          <div className="ap-table-ico">
                            {meta.img ? (
                              <img src={meta.img} alt={sym} onError={e => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('ap-pos-ico-fb-hide');
                              }} />
                            ) : null}
                            <span className="ap-pos-ico-fb">{meta.icon}</span>
                          </div>
                          <div>
                            <p className="ap-table-sym">{sym}</p>
                            <p className="ap-table-time">{fmtTime(t.createdAt)}</p>
                          </div>
                        </div>
                        <div className="ap-table-cell ap-table-amount">{fmtUsd(t.amount)}</div>
                        <div className="ap-table-cell ap-table-status">
                          <span className={`ap-status ${ok ? 'ok' : 'fail'}`}>{t.status}</span>
                        </div>
                        <div className="ap-table-cell ap-table-date">{fmtDate(t.createdAt)}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
