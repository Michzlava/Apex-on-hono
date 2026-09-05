import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './assets-page.css';

type Position = {
  id: string; asset: string; symbol: string; quantity: number;
  entryPrice: number; currentPnl: number; side: string; status: string;
  openedAt: string; closedAt: string | null;
};
type Trade = { id: string; asset: string | null; action: string | null; amount: number; status: string; createdAt: string };
type AssetsData = { portfolioBalance: number; realisedPnl: number; positions: Position[]; trades: Trade[] };

const ASSET_META: Record<string, { label: string; icon: string; img?: string }> = {
  BTC: { label: 'Bitcoin', icon: '₿', img: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  ETH: { label: 'Ethereum', icon: 'Ξ', img: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  SOL: { label: 'Solana', icon: '◎', img: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  BNB: { label: 'BNB', icon: 'B', img: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  AAPL: { label: 'Apple', icon: 'A', img: 'https://img.logo.dev/apple.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  TSLA: { label: 'Tesla', icon: 'T', img: 'https://img.logo.dev/tesla.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  NVDA: { label: 'NVIDIA', icon: 'N', img: 'https://img.logo.dev/nvidia.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  MSFT: { label: 'Microsoft', icon: 'M', img: 'https://img.logo.dev/microsoft.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  AMZN: { label: 'Amazon', icon: 'A', img: 'https://img.logo.dev/amazon.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  GOOGL: { label: 'Alphabet', icon: 'G', img: 'https://img.logo.dev/google.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  USOIL: { label: 'WTI Crude', icon: '🛢' }, UKOIL: { label: 'Brent', icon: '🛢' },
  XAUUSD: { label: 'Gold', icon: '🥇' }, EURUSD: { label: 'EUR/USD', icon: '€' },
  GBPUSD: { label: 'GBP/USD', icon: '£' }, USDJPY: { label: 'USD/JPY', icon: '¥' },
  USD: { label: 'US Dollar', icon: '$' },
};

const ALLOC_COLORS: Record<string, string> = {
  BTC: '#f7931a', ETH: '#627eea', SOL: '#9945ff', BNB: '#f3ba2f',
  AAPL: '#a3a3a3', TSLA: '#e31937', NVDA: '#76b900', MSFT: '#00a4ef', AMZN: '#ff9900', GOOGL: '#4285f4',
  USOIL: '#94a3b8', UKOIL: '#64748b', XAUUSD: '#eab308',
  EURUSD: '#14b8a6', GBPUSD: '#0ea5e9', USDJPY: '#f43f5e',
};

const PRICE_SYMBOL_MAP: Record<string, string> = {
  USOIL: 'USOIL', UKOIL: 'UKOIL', XAUUSD: 'XAUUSD',
  EURUSD: 'EURUSD', GBPUSD: 'GBPUSD', USDJPY: 'USDJPY',
};

const getMeta = (s: string) => ASSET_META[s] ?? { label: s, icon: '?' };
const allocColor = (s: string) => ALLOC_COLORS[s] ?? '#64748b';

function tradeSymbol(t: Trade): string {
  if (!t.asset) return 'USD';
  const sym = t.asset.split(':')[1]?.trim();
  return sym && sym.length > 0 ? sym : 'USD';
}
function fmtUsd(n: number, d = 2) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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

  const fetchLivePrices = async (positions: Position[]) => {
    const syms = Array.from(new Set(positions.filter(p => p.status === 'OPEN').map(p => p.symbol)));
    for (const sym of syms) {
      const apiSym = PRICE_SYMBOL_MAP[sym] ?? sym.replace('USD', '');
      try {
        const res = await fetch(`/api/price?symbol=${apiSym}`, { credentials: 'include' });
        const d = await res.json();
        if (d.price) setLivePrices(prev => ({ ...prev, [sym]: d.price }));
      } catch {}
    }
  };

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/assets', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const json: AssetsData = await res.json();
      setData(json);
      fetchLivePrices(json.positions);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openPositions   = useMemo(() => data?.positions.filter(p => p.status === 'OPEN')   ?? [], [data]);
  const closedPositions = useMemo(() => data?.positions.filter(p => p.status === 'CLOSED') ?? [], [data]);

  const livePnlOf = (p: Position) => {
    const cur = livePrices[p.symbol] ?? 0;
    if (!cur) return p.currentPnl;
    const dir = p.side === 'SHORT' ? -1 : 1;
    return dir * (cur - p.entryPrice) * p.quantity;
  };

  const unrealisedPnl = useMemo(() => openPositions.reduce((s, p) => s + livePnlOf(p), 0), [openPositions, livePrices]);
  const totalPnl = (data?.realisedPnl ?? 0) + unrealisedPnl;

  /* exposure / allocation from live notionals */
  const allocation = useMemo(() => {
    const rows = openPositions.map(p => ({
      symbol: p.symbol,
      value: (livePrices[p.symbol] ?? p.entryPrice) * p.quantity,
    }));
    const total = rows.reduce((a, r) => a + r.value, 0);
    return { rows: rows.sort((a, b) => b.value - a.value), total };
  }, [openPositions, livePrices]);

  if (loading) {
    return (
      <div className="ap-wrap">
        <div className="ap-inner">
          <div className="ap-skeleton" style={{ height: 84 }} />
          <div className="ap-skeleton" style={{ height: 64 }} />
          <div className="ap-skeleton" style={{ height: 46 }} />
          <div className="ap-skeleton" style={{ height: 160 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="ap-wrap">
      <div className="ap-inner">

        {/* ══ terminal header ══ */}
        <div className="ap-head">
          <div>
            <p className="ap-eyebrow"><span className="ap-eyebrow-pip" />Apex · Mkts — Portfolio</p>
            <p className="ap-balance">{fmtUsd(data?.portfolioBalance ?? 0)}</p>
            <div className="ap-head-chips">
              <span className={`ap-chip ${totalPnl >= 0 ? 'pos' : 'neg'}`}>
                {totalPnl >= 0 ? '▲' : '▼'} {totalPnl >= 0 ? '+' : ''}{fmtUsd(totalPnl)} ALL-TIME
              </span>
              <span className="ap-chip ghost">{openPositions.length} OPEN</span>
            </div>
          </div>
          <button className="ap-refresh" onClick={() => loadData(true)} disabled={refreshing} aria-label="Refresh">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        {/* ══ stat strip ══ */}
        <section className="ap-card ap-strip">
          <div className="ap-strip-cell">
            <p className="ap-strip-lbl">Unrealised</p>
            <p className={`ap-strip-val ${unrealisedPnl >= 0 ? 'pos' : 'neg'}`}>
              {unrealisedPnl >= 0 ? '+' : ''}{fmtUsd(unrealisedPnl)}
            </p>
          </div>
          <div className="ap-strip-cell">
            <p className="ap-strip-lbl">Realised</p>
            <p className={`ap-strip-val ${(data?.realisedPnl ?? 0) >= 0 ? 'pos' : 'neg'}`}>
              {(data?.realisedPnl ?? 0) >= 0 ? '+' : ''}{fmtUsd(data?.realisedPnl ?? 0)}
            </p>
          </div>
          <div className="ap-strip-cell">
            <p className="ap-strip-lbl">Deployed</p>
            <p className="ap-strip-val">{fmtUsd(allocation.total, 0)}</p>
          </div>
        </section>

        {/* ══ compact actions ══ */}
        <div className="ap-actions">
          <Link to="/dashboard/deposit" className="ap-action"><span className="ap-action-ico pos">＋</span>Deposit</Link>
          <Link to="/dashboard/withdraw" className="ap-action"><span className="ap-action-ico neg">↑</span>Withdraw</Link>
          <Link to="/dashboard/trade" className="ap-action"><span className="ap-action-ico acc">⇄</span>Trade</Link>
        </div>

        {/* ══ exposure / allocation ══ */}
        {allocation.rows.length > 0 && (
          <section className="ap-card">
            <header className="ap-card-head">
              <h2>Exposure</h2>
              <span className="ap-head-note">{allocation.rows.length} ASSETS</span>
            </header>
            <div className="ap-alloc-bar">
              {allocation.rows.map(r => (
                <span
                  key={r.symbol}
                  style={{ width: `${Math.max((r.value / allocation.total) * 100, 3)}%`, background: allocColor(r.symbol) }}
                  title={`${r.symbol} ${((r.value / allocation.total) * 100).toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="ap-alloc-legend">
              {allocation.rows.map(r => (
                <div className="ap-alloc-item" key={r.symbol}>
                  <span className="ap-alloc-dot" style={{ background: allocColor(r.symbol) }} />
                  <span className="ap-alloc-sym">{r.symbol}</span>
                  <span className="ap-alloc-w">{((r.value / allocation.total) * 100).toFixed(1)}%</span>
                  <span className="ap-alloc-val">{fmtUsd(r.value, 0)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══ tabs ══ */}
        <div className="ap-tabs">
          {([
            { key: 'open', label: 'Open', count: openPositions.length },
            { key: 'closed', label: 'Closed', count: closedPositions.length },
            { key: 'history', label: 'History', count: data?.trades.length ?? 0 },
          ] as const).map(t => (
            <button key={t.key} className={`ap-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              {t.count > 0 && <span className="ap-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* ══ open positions ══ */}
        {tab === 'open' && (
          <section className="ap-card">
            {openPositions.length === 0 ? (
              <div className="ap-empty">
                <p className="ap-empty-ico">📊</p>
                <p className="ap-empty-title">No open positions</p>
                <p className="ap-empty-sub">Place a trade to get started.</p>
                <Link to="/dashboard/trade" className="ap-empty-cta">Start Trading →</Link>
              </div>
            ) : openPositions.map(pos => {
              const cur = livePrices[pos.symbol] ?? 0;
              const pnl = livePnlOf(pos);
              const pct = pos.entryPrice > 0 ? (pnl / (pos.entryPrice * pos.quantity)) * 100 : 0;
              const meta = getMeta(pos.symbol);
              return (
                <Link to={`/dashboard/trade?asset=${pos.symbol}`} key={pos.id} className="ap-pos">
                  <div className="ap-pos-ico">
                    {meta.img && <img src={meta.img} alt="" onError={e => e.currentTarget.parentElement?.classList.add('broken')} />}
                    <span className="ap-pos-ico-fb">{meta.icon}</span>
                  </div>
                  <div className="ap-pos-meta">
                    <p className="ap-pos-line1">
                      <span className="ap-pos-sym">{pos.symbol}</span>
                      <span className={`ap-pos-side ${pos.side === 'LONG' ? 'long' : 'short'}`}>{pos.side}</span>
                    </p>
                    <p className="ap-pos-line2">
                      {fmtQty(pos.quantity)} @ {fmtUsd(pos.entryPrice)}{cur > 0 ? ` → ${fmtUsd(cur)}` : ''}
                    </p>
                  </div>
                  <div className="ap-pos-pnl">
                    <span className={`ap-pos-pnl-val ${pnl >= 0 ? 'pos' : 'neg'}`}>{pnl >= 0 ? '+' : ''}{fmtUsd(pnl)}</span>
                    <span className={`ap-pos-pnl-pct ${pnl >= 0 ? 'pos' : 'neg'}`}>{pnl >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
                  </div>
                  <span className="ap-pos-arrow">→</span>
                </Link>
              );
            })}
          </section>
        )}

        {/* ══ closed positions ══ */}
        {tab === 'closed' && (
          <section className="ap-card">
            {closedPositions.length === 0 ? (
              <div className="ap-empty">
                <p className="ap-empty-ico">📉</p>
                <p className="ap-empty-title">No closed positions</p>
                <p className="ap-empty-sub">Completed trades will appear here.</p>
              </div>
            ) : closedPositions.map(pos => {
              const meta = getMeta(pos.symbol);
              return (
                <div key={pos.id} className="ap-pos static">
                  <div className="ap-pos-ico">
                    {meta.img && <img src={meta.img} alt="" onError={e => e.currentTarget.parentElement?.classList.add('broken')} />}
                    <span className="ap-pos-ico-fb">{meta.icon}</span>
                  </div>
                  <div className="ap-pos-meta">
                    <p className="ap-pos-line1">
                      <span className="ap-pos-sym">{pos.symbol}</span>
                      <span className="ap-pos-side closed">{pos.side}</span>
                    </p>
                    <p className="ap-pos-line2">
                      @ {fmtUsd(pos.entryPrice)} · closed {fmtDate(pos.closedAt ?? pos.openedAt)}
                    </p>
                  </div>
                  <div className="ap-pos-pnl">
                    <span className={`ap-pos-pnl-val ${pos.currentPnl >= 0 ? 'pos' : 'neg'}`}>
                      {pos.currentPnl >= 0 ? '+' : ''}{fmtUsd(pos.currentPnl)}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ══ trade history ══ */}
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
                  <span>Asset</span><span>Amount</span><span>Status</span><span>Date</span>
                </div>
                {data?.trades.map(t => {
                  const sym = tradeSymbol(t);
                  const ok = t.status === 'COMPLETED';
                  const meta = getMeta(sym);
                  return (
                    <div key={t.id} className="ap-table-row">
                      <div className="ap-table-cell ap-table-asset">
                        <div className="ap-table-ico">
                          {meta.img && <img src={meta.img} alt="" onError={e => e.currentTarget.parentElement?.classList.add('broken')} />}
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
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
