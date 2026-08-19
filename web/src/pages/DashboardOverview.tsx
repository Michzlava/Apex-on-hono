import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './dashboard-overview.css';

type Transaction = {
  id: string;
  type: 'Deposit' | 'Withdrawal' | 'Trade';
  asset: string;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  createdAt: string;
};

type Market = {
  symbol: string;
  name: string;
  logoUrl: string;
  price: number;
  changePercent: number;
};

type DepositMethod = {
  id: string;
  label: string;
  icon: string;
  logoUrl?: string | null;
  address: string;
  network?: string;
  note?: string;
};

type DashboardData = {
  user: {
    id: string;
    name: string;
    firstName: string;
    email: string;
    portfolioBalance: number;
    portfolioChangePercent: number;
    realisedPnl: number;
    volatility: number;
    riskLabel: string;
    kycStatus: string;
    fearGreedIndex?: number;
  };
  transactions: Transaction[];
  positions: { open: number; profit: number; loss: number };
  notifications: { id: string; message: string; read: boolean }[];
  activityLogs: { id: string; description: string }[];
};

type NewsItem = {
  headline: string;
  summary: string;
  source: string;
  time: string;
  tag: string;
  url: string;
};

function fmt(n: number | null | undefined, d = 2) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function Sparkline({ positive = true, width = 80, height = 32 }: { positive?: boolean; width?: number; height?: number }) {
  const pts = positive
    ? '0,28 14,20 28,22 42,12 56,16 70,6 80,8'
    : '0,6 14,12 28,10 42,20 56,16 70,24 80,28';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <polyline points={pts} stroke={positive ? 'var(--green)' : 'var(--red)'}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function FearGreedGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));

  const getZone = (v: number) => {
    if (v <= 24) return { label: 'Extreme Bear', color: 'var(--red)' };
    if (v <= 44) return { label: 'Fear',         color: '#fb923c' };
    if (v <= 55) return { label: 'Neutral',      color: 'var(--gold)' };
    if (v <= 74) return { label: 'Positive',     color: '#a3e635' };
    return             { label: 'Very Positive', color: 'var(--green)' };
  };
  const zone = getZone(clamped);

  const W = 120, H = 68;
  const cx = W / 2, cy = 62;
  const r = 46;

  const segments = [
    { from: 0,  to: 25,  color: '#f87171' },
    { from: 25, to: 45,  color: '#fb923c' },
    { from: 45, to: 55,  color: '#fbbf24' },
    { from: 55, to: 75,  color: '#a3e635' },
    { from: 75, to: 100, color: '#4ade80' },
  ];

  function polarToCart(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(Math.PI - rad),
      y: cy - radius * Math.sin(Math.PI - rad),
    };
  }

  function arcPath(fromPct: number, toPct: number, rOuter: number, rInner: number) {
    const a1 = (fromPct / 100) * 180;
    const a2 = (toPct  / 100) * 180;
    const p1 = polarToCart(a1, rOuter);
    const p2 = polarToCart(a2, rOuter);
    const p3 = polarToCart(a2, rInner);
    const p4 = polarToCart(a1, rInner);
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <path d={arcPath(0, 100, r, r - 10)} fill="var(--bg-3)" />
        {segments.map((seg, i) => (
          <path key={i} d={arcPath(seg.from, seg.to, r, r - 10)} fill={seg.color} opacity="0.85" />
        ))}
        <g style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: `rotate(${(clamped / 100) * 180 - 90}deg)`,
          transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 8)}
            stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r="4" fill="var(--ink)" />
        <text x={cx} y={cy - 14} textAnchor="middle" fill={zone.color}
          style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', fontWeight: 700 }}>
          {clamped}
        </text>
      </svg>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: '0.6rem', fontWeight: 700,
        color: zone.color, letterSpacing: '0.06em', marginTop: -4,
        textTransform: 'uppercase'
      }}>
        {zone.label}
      </span>
    </div>
  );
}

function MethodPill({
  m, active, onClick,
}: { m: DepositMethod; active: boolean; onClick: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      onClick={onClick}
      className={`method-pill ${active ? 'active' : 'inactive'}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {m.logoUrl && !imgFailed ? (
        <img
          src={m.logoUrl}
          alt={m.label}
          style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span>{m.icon}</span>
      )}
      {m.label}
    </button>
  );
}

export default function DashboardOverview() {
  const navigate = useNavigate();
  const [time, setTime] = useState('');
  const [sheet, setSheet] = useState<'deposit' | null>(null);
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState('');
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [expandedNewsIdx, setExpandedNewsIdx] = useState<number | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/user/dashboard', { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, []);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      if (res.ok) setMarkets(await res.json());
    } catch {}
  }, []);

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error('news fetch failed');
      const data = await res.json();
      setNews(data.news ?? []);
    } catch {
      setNews([]);
    } finally { setNewsLoading(false); }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchMarkets();
    fetchNews();
    const id = setInterval(fetchMarkets, 60_000);
    return () => clearInterval(id);
  }, [fetchDashboard, fetchMarkets, fetchNews]);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const openDeposit = async () => {
    setSheet('deposit');
    setMethodsLoading(true);
    try {
      const res = await fetch('/api/admin/deposit-methods', { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setDepositMethods(d);
        if (d.length > 0) setMethod(d[0].id);
      }
    } finally { setMethodsLoading(false); }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeSheet = () => { setSheet(null); setCopied(false); };

  const balance      = data?.user.portfolioBalance ?? 0;
  const firstName    = data?.user.firstName        ?? '';
  const userId       = data?.user.id?.slice(-6).toUpperCase() ?? '------';
  const openPositions = data?.positions.open       ?? 0;
  const profitPos    = data?.positions.profit      ?? 0;
  const lossPos      = data?.positions.loss        ?? 0;
  const activityLogs = data?.activityLogs          ?? [];

  const profit        = data?.user.realisedPnl            ?? 0;
  const changePercent = data?.user.portfolioChangePercent ?? 0;
  const isProfitable  = profit >= 0;

  const fearGreedValue = useMemo(() => {
    const weights: Record<string, number> = { BTC: 0.4, ETH: 0.3, SOL: 0.2, BNB: 0.1 };
    let weightedSum = 0, totalWeight = 0;
    for (const [sym, w] of Object.entries(weights)) {
      const asset = markets.find(m => m.symbol === sym);
      if (asset) { weightedSum += asset.changePercent * w; totalWeight += w; }
    }
    if (totalWeight === 0) return data?.user.fearGreedIndex ?? 52;
    const avg = weightedSum / totalWeight;
    const clamped = Math.max(-5, Math.min(5, avg));
    return Math.round(((clamped + 5) / 10) * 100);
  }, [markets, data?.user.fearGreedIndex]);

  const activeMethod = depositMethods.find(m => m.id === method);

  const topGainers = [...markets]
    .filter(m => m.changePercent >= 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 3);

  const topLosers = [...markets]
    .filter(m => m.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 3);

  const QUICK_TRADE_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB'];
  const CRYPTO_SYMS = ['BTC', 'ETH', 'SOL', 'BNB'];

  const quickTradeAssets = QUICK_TRADE_SYMBOLS
    .map(sym => markets.find(m => m.symbol === sym))
    .filter((m): m is Market => Boolean(m));

  const handleQuickTrade = (symbol: string, action: 'BUY' | 'SELL') => {
    const tradeSymbol = CRYPTO_SYMS.includes(symbol) ? `${symbol}USD` : symbol;
    navigate(`/dashboard/trade?asset=${tradeSymbol}&action=${action}`);
  };

  const tagColors: Record<string, [string, string]> = {
    CRYPTO:      ['var(--accent-l)', 'var(--accent)'],
    FOREX:       ['var(--green-l)',  '#a3e635'],
    STOCKS:      ['var(--bg-3)',     '#818cf8'],
    MACRO:       ['var(--gold-l)',   'var(--gold)'],
    COMMODITIES: ['var(--red-l)',    '#fb923c'],
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--line-strong)', borderTopColor: 'var(--ink-dim)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="dash-wrap">

      <div className="d-header">
        <div>
          <p className="d-greeting">Welcome back,</p>
          <p className="d-name">{firstName}</p>
          <p className="d-uid">APEX·MKTS / {userId}</p>
        </div>
        <div className="d-header-right">
          <div className="d-live-chip"><span className="live-dot" />Live</div>
          <span className="d-clock">{time}</span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-main">

          <div className="hero-card">
            <p className="bal-eyebrow">Net Asset Value</p>
            <p className="bal-amount"><sup>$</sup>{fmt(balance, 0)}<span className="cents">.00</span></p>
            <div className="bal-row">
              <span className={`bal-change ${isProfitable ? 'pos' : 'neg'}`}>
                {isProfitable ? '+' : ''}{fmt(profit)} ({isProfitable ? '+' : ''}{fmt(changePercent)}%)
              </span>
              <span className="bal-period">. </span>
            </div>
            <div className="bal-sparkline"><Sparkline positive={isProfitable} width={140} height={30} /></div>
            <div className="bal-actions">
              <button className="btn-dep" onClick={openDeposit}>+ Deposit</button>
              <Link to="/dashboard/withdraw" className="btn-ghost">Withdraw</Link>
              <Link to="/dashboard/history" className="btn-ghost">📋 History</Link>
            </div>
          </div>

          <div className="stat-row">
            <div className="stat-cell">
              <p className="stat-lbl">P &amp; L</p>
              <p className={`stat-val ${isProfitable ? 'pos' : 'neg'}`}>
                {isProfitable ? '+' : ''}{fmt(profit)}
              </p>
              <p className="stat-sub">Realised</p>
            </div>
            <div className="stat-cell">
              <p className="stat-lbl">Positions</p>
              <p className="stat-val">{openPositions} open</p>
              <p className="stat-sub">{profitPos} profit · {lossPos} loss</p>
            </div>
            <div className="stat-cell fg-cell">
              <p className="stat-lbl" style={{ textAlign: 'center', marginBottom: 4 }}>Sentiment</p>
              <FearGreedGauge value={fearGreedValue} />
            </div>
          </div>

          <div className="section-divider" />

          <p className="section-label">
            <span className="section-label-left"><span className="section-label-pip" />Top Movers</span>
            <Link to="/dashboard/markets" className="section-view-all">View all →</Link>
          </p>
          <div className="movers-split">
            <div className="movers-card">
              <p className="movers-card-title gainers">↑ Top Gainers</p>
              {topGainers.length === 0
                ? <p className="movers-empty">{markets.length === 0 ? 'No data' : 'Markets are down across the board'}</p>
                : topGainers.map(m => (
                  <div key={m.symbol} className="movers-split-item">
                    <span className="movers-split-sym">{m.symbol}</span>
                    <span className="movers-split-price">${fmt(m.price)}</span>
                    <span className="movers-split-chg up">+{fmt(m.changePercent)}%</span>
                  </div>
                ))}
            </div>
            <div className="movers-card">
              <p className="movers-card-title losers">↓ Top Losers</p>
              {topLosers.length === 0
                ? <p className="movers-empty">{markets.length === 0 ? 'No data' : 'Markets are up across the board'}</p>
                : topLosers.map(m => (
                  <div key={m.symbol} className="movers-split-item">
                    <span className="movers-split-sym">{m.symbol}</span>
                    <span className="movers-split-price">${fmt(m.price)}</span>
                    <span className="movers-split-chg dn">{fmt(m.changePercent)}%</span>
                  </div>
                ))}
            </div>
          </div>

          <p className="section-label">
            <span className="section-label-left"><span className="section-label-pip" />Quick Trade</span>
            <Link to="/dashboard/markets" className="section-view-all">View all →</Link>
          </p>
          <div className="qt-card">
            {quickTradeAssets.length === 0
              ? <p style={{ fontSize: '0.62rem', color: 'var(--ink-faint)', padding: '14px' }}>No data</p>
              : quickTradeAssets.map(a => (
                <div key={a.symbol} className="qt-row">
                  <div className="qt-asset">
                    {a.logoUrl
                      ? <img src={a.logoUrl} alt={a.symbol} className="qt-ico-img"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : <div className="qt-ico">{a.symbol.slice(0, 2)}</div>
                    }
                    <div className="qt-meta">
                      <div className="qt-sym">{a.symbol}</div>
                      <div className="qt-price">${fmt(a.price)}</div>
                    </div>
                  </div>
                  <span className={`qt-chg ${a.changePercent >= 0 ? 'up' : 'dn'}`}>
                    {a.changePercent >= 0 ? '+' : ''}{fmt(a.changePercent)}%
                  </span>
                  <div className="qt-btns">
                    <button className="btn-buy" onClick={() => handleQuickTrade(a.symbol, 'BUY')}>Buy</button>
                    <button className="btn-sell" onClick={() => handleQuickTrade(a.symbol, 'SELL')}>Sell</button>
                  </div>
                </div>
              ))}
          </div>

        </div>

        <div className="dash-side">

          <p className="section-label">
            <span className="section-label-left"><span className="section-label-pip" />Recent Activity</span>
            <Link to="/dashboard/history" className="section-view-all">View all →</Link>
          </p>
          <div className="full-card">
            {activityLogs.length === 0
              ? <p style={{ fontSize: '0.62rem', color: 'var(--ink-faint)' }}>No recent activity</p>
              : activityLogs.slice(0, 5).map(a => (
                <p key={a.id} className="activity-item">{a.description}</p>
              ))}
          </div>

          <div className="section-divider" />

          <p className="section-label"><span className="section-label-left"><span className="section-label-pip" />Global Finance News</span></p>
          <div className="news-section">
            <div className="news-wrap">
              {newsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', gap: 10 }}>
                  <div style={{ width: 22, height: 22, border: '2.5px solid var(--line-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dspin 0.7s linear infinite' }} />
                  <p style={{ fontSize: '0.62rem', color: 'var(--ink-faint)' }}>Fetching latest news…</p>
                </div>
              ) : news.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', fontWeight: 300 }}>No news available.</p>
                </div>
              ) : (
                <>
                  {news.map((item, i) => {
                    const [tagBg, tagCol] = tagColors[item.tag] ?? ['var(--surface)', 'var(--ink-dim)'];
                    const isExpanded = expandedNewsIdx === i;
                    return (
                      <div key={i} className="news-entry">
                        <div
                          className="news-item"
                          style={{ cursor: 'pointer' }}
                          onClick={() => setExpandedNewsIdx(isExpanded ? null : i)}
                        >
                          <span className="news-tag" style={{ background: tagBg, color: tagCol }}>{item.tag}</span>
                          <div className="news-body">
                            <p className="news-headline">{item.headline}</p>
                            <p className="news-meta">{item.source} · {item.time}</p>
                          </div>
                          <span style={{
                            color: 'var(--ink-faint)', fontSize: '0.7rem', flexShrink: 0,
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.15s', marginTop: 2,
                          }}>▾</span>
                        </div>
                        {isExpanded && (
                          <div className="news-expand">
                            {item.summary
                              ? <p className="news-summary">{item.summary}</p>
                              : <p className="news-summary news-summary-empty">No summary available.</p>
                            }
                            {item.url && (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="news-readmore">
                                Read full article →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="news-pulse">
                    <span className="news-pulse-dot" />
                    <span style={{ fontSize: '0.58rem', color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>Live · CryptoCompare &amp; BBC Business</span>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {sheet === 'deposit' && (
        <>
          <div className="sheet-overlay" onClick={closeSheet} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
              <p className="sheet-title">Quick Deposit</p>
              <button
                onClick={closeSheet}
                style={{
                  width: 35, height: 35, borderRadius: '50%',
                  background: 'var(--surface)', border: '1px solid var(--line-strong)',
                  color: 'var(--red)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem',
                  flexShrink: 0, marginTop: 2, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink-faint)'; }}
              >
                ✕
              </button>
            </div>
            <p className="sheet-sub">Copy an address and make instant deposit</p>

            {methodsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: 12 }}>
                <div style={{ width: 26, height: 26, border: '2.5px solid var(--line-strong)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'dspin 0.7s linear infinite' }} />
                <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)' }}>Loading…</p>
              </div>
            ) : depositMethods.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <p style={{ fontSize: '1.8rem', marginBottom: 10 }}>🔧</p>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>No deposit methods yet</p>
                <p style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', fontWeight: 300 }}>Contact support or check back later.</p>
              </div>
            ) : (
              <>
                <div
                  className="method-pills-row"
                  style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}
                >
                  {depositMethods.map(m => (
                    <MethodPill
                      key={m.id}
                      m={m}
                      active={method === m.id}
                      onClick={() => setMethod(m.id)}
                    />
                  ))}
                </div>

                {activeMethod && (
                  <div className="addr-box">
                    {activeMethod.logoUrl && (
                      <div className="addr-method-header">
                        <img
                          src={activeMethod.logoUrl}
                          alt={activeMethod.label}
                          className="addr-method-logo"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div>
                          <p className="addr-method-name">{activeMethod.label}</p>
                          {activeMethod.network && (
                            <p className="addr-network" style={{ marginBottom: 0 }}>
                              Network: {activeMethod.network}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {!activeMethod.logoUrl && activeMethod.network && (
                      <p className="addr-network">Network: {activeMethod.network}</p>
                    )}
                    <p className="addr-text">{activeMethod.address}</p>
                    <button
                      onClick={() => copyAddress(activeMethod.address)}
                      className={`copy-btn ${copied ? 'done' : 'idle'}`}
                    >
                      {copied ? '✓ Copied!' : '📋 Copy Address'}
                    </button>
                  </div>
                )}
                {activeMethod?.note && (
                  <div className="note-box">
                    <span style={{ fontSize: '0.85rem' }}>⚠️</span>
                    <p className="note-text">{activeMethod.note}</p>
                  </div>
                )}
              </>
            )}
            <Link to="/dashboard/deposit" className="sheet-full-link" onClick={closeSheet}>
              Submit→
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
