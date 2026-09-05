import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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

type Period = '1D' | '7D' | '1M' | '1Y';
type MktTab = 'watch' | 'gainers' | 'losers';

const WATCH_SYMS = ['BTC', 'ETH', 'SOL', 'BNB'];
const CRYPTO_SYMS = ['BTC', 'ETH', 'SOL', 'BNB'];
const PERIOD_CFG: Record<Period, { pts: number; vol: number }> = {
  '1D': { pts: 26, vol: 0.55 },
  '7D': { pts: 40, vol: 1 },
  '1M': { pts: 52, vol: 1.7 },
  '1Y': { pts: 64, vol: 2.6 },
};
const CHART_W = 640, CHART_H = 176, PAD_T = 14, PAD_B = 16;

function fmt(n: number | null | undefined, d = 2) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function symSeed(sym: string) {
  let a = 0;
  for (const c of sym) a += c.charCodeAt(0);
  return a;
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const mx = (p.x + c.x) / 2;
    d += ` C ${mx} ${p.y}, ${mx} ${c.y}, ${c.x} ${c.y}`;
  }
  return d;
}

/* ── deterministic mini sparkline for market rows ─────────────────── */
function MiniSpark({ positive, seed }: { positive: boolean; seed: number }) {
  const points = useMemo(() => {
    let s = (seed % 997) + 11;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const n = 14;
    const arr: number[] = [];
    let v = 50;
    for (let i = 0; i < n; i++) {
      v += (rnd() - (positive ? 0.4 : 0.6)) * 17;
      v = Math.max(8, Math.min(92, v));
      arr.push(v);
    }
    return arr.map((y, i) => `${((i / (n - 1)) * 62 + 1).toFixed(1)},${(29 - (y / 100) * 27).toFixed(1)}`).join(' ');
  }, [positive, seed]);

  return (
    <svg className={`mini-spark ${positive ? 'up' : 'dn'}`} width="64" height="30" viewBox="0 0 64 30" fill="none">
      <polyline points={points} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/* ── Fear & Greed gauge ───────────────────────────────────────────── */
function FearGreedGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));

  const getZone = (v: number) => {
    if (v <= 24) return { label: 'Extreme Bear', color: 'var(--neg)' };
    if (v <= 44) return { label: 'Fear',         color: '#ff8a5c' };
    if (v <= 55) return { label: 'Neutral',      color: 'var(--gold)' };
    if (v <= 74) return { label: 'Positive',     color: '#a3e635' };
    return             { label: 'Very Positive', color: 'var(--pos)' };
  };
  const zone = getZone(clamped);

  const W = 150, H = 88, cx = W / 2, cy = 74, r = 58;

  const segments = [
    { from: 0,  to: 25,  color: '#ff5c74' },
    { from: 25, to: 45,  color: '#ff8a5c' },
    { from: 45, to: 55,  color: '#f2b63c' },
    { from: 55, to: 75,  color: '#a3e635' },
    { from: 75, to: 100, color: '#2fd980' },
  ];

  const polarToCart = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(Math.PI - rad),
      y: cy - radius * Math.sin(Math.PI - rad),
    };
  };

  const arcPath = (fromPct: number, toPct: number, rOuter: number, rInner: number) => {
    const a1 = (fromPct / 100) * 180;
    const a2 = (toPct / 100) * 180;
    const p1 = polarToCart(a1, rOuter);
    const p2 = polarToCart(a2, rOuter);
    const p3 = polarToCart(a2, rInner);
    const p4 = polarToCart(a1, rInner);
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
  };

  return (
    <div className="fg-gauge">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {segments.map((seg, i) => (
          <path key={i} d={arcPath(seg.from + 0.8, seg.to - 0.8, r, r - 12)} fill={seg.color} opacity="0.9" />
        ))}
        <g style={{
          transformOrigin: `${cx}px ${cy}px`,
          transform: `rotate(${(clamped / 100) * 180 - 90}deg)`,
          transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 10)}
            stroke="var(--tx1)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r="4.5" fill="var(--tx1)" />
        <text x={cx} y={cy - 18} textAnchor="middle" fill={zone.color}
          style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 700 }}>
          {clamped}
        </text>
      </svg>
      <span className="fg-zone" style={{ color: zone.color }}>{zone.label}</span>
    </div>
  );
}

/* ── deposit method pill ──────────────────────────────────────────── */
function MethodPill({ m, active, onClick }: { m: DepositMethod; active: boolean; onClick: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button onClick={onClick} className={`method-pill ${active ? 'active' : ''}`}>
      {m.logoUrl && !imgFailed ? (
        <img src={m.logoUrl} alt={m.label} className="pill-logo" onError={() => setImgFailed(true)} />
      ) : (
        <span>{m.icon}</span>
      )}
      {m.label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
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
  const [period, setPeriod] = useState<Period>('7D');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mktTab, setMktTab] = useState<MktTab>('watch');
  const [flash, setFlash] = useState<Record<string, 'up' | 'dn'>>({});
  const prevPrices = useRef<Record<string, number>>({});

  /* ── data fetching (unchanged endpoints) ── */
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
      const d = await res.json();
      setNews(d.news ?? []);
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

  /* ── price flash on market updates ── */
  useEffect(() => {
    const next: Record<string, 'up' | 'dn'> = {};
    for (const m of markets) {
      const prev = prevPrices.current[m.symbol];
      if (prev !== undefined && prev !== m.price) next[m.symbol] = m.price > prev ? 'up' : 'dn';
      prevPrices.current[m.symbol] = m.price;
    }
    if (Object.keys(next).length) {
      setFlash(next);
      const t = setTimeout(() => setFlash({}), 900);
      return () => clearTimeout(t);
    }
  }, [markets]);

  /* ── derived data ── */
  const balance       = data?.user.portfolioBalance ?? 0;
  const firstName     = data?.user.firstName ?? '';
  const userId        = data?.user.id?.slice(-6).toUpperCase() ?? '------';
  const kycStatus     = data?.user.kycStatus ?? 'PENDING';
  const kycOk         = /verif|approv|complete/i.test(kycStatus);
  const openPositions = data?.positions.open ?? 0;
  const profitPos     = data?.positions.profit ?? 0;
  const lossPos       = data?.positions.loss ?? 0;
  const activityLogs  = data?.activityLogs ?? [];
  const profit        = data?.user.realisedPnl ?? 0;
  const changePercent = data?.user.portfolioChangePercent ?? 0;
  const volatility    = data?.user.volatility ?? 0;
  const riskLabel     = data?.user.riskLabel ?? '—';
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

  /* ── synthetic-but-deterministic NAV series for the chart ── */
  const series = useMemo(() => {
    if (!balance) return [] as number[];
    const cfg = PERIOD_CFG[period];
    const start = balance / (1 + changePercent / 100);
    let s = (Math.round(balance) + cfg.pts * 97) % 233280 || 13;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const n = cfg.pts;
    const amp = Math.abs(balance - start) * 0.22 + balance * 0.004 * cfg.vol;
    const drift = (balance - start) / n;
    const out: number[] = [];
    let v = start;
    for (let i = 0; i < n; i++) {
      v += drift + (rnd() - 0.5) * 2 * amp;
      out.push(Math.max(v, balance * 0.2));
    }
    out.push(balance);
    return out;
  }, [balance, changePercent, period]);

  const chart = useMemo(() => {
    if (series.length < 2) return null;
    const min = Math.min(...series), max = Math.max(...series);
    const span = max - min || 1;
    const X = (i: number) => (i / (series.length - 1)) * CHART_W;
    const Y = (v: number) => PAD_T + (1 - (v - min) / span) * (CHART_H - PAD_T - PAD_B);
    const pts = series.map((v, i) => ({ x: X(i), y: Y(v) }));
    const line = smoothPath(pts);
    const area = `${line} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;
    return { min, max, X, Y, pts, line, area };
  }, [series]);

  const topGainers = [...markets].filter(m => m.changePercent >= 0)
    .sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const topLosers = [...markets].filter(m => m.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

  const rowsByTab: Market[] =
    mktTab === 'watch'
      ? WATCH_SYMS.map(s => markets.find(m => m.symbol === s)).filter((m): m is Market => Boolean(m))
      : mktTab === 'gainers' ? topGainers : topLosers;

  /* ── actions ── */
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
    navigator.clipboard?.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeSheet = () => { setSheet(null); setCopied(false); };

  const handleQuickTrade = (symbol: string, action: 'BUY' | 'SELL') => {
    const tradeSymbol = CRYPTO_SYMS.includes(symbol) ? `${symbol}USD` : symbol;
    navigate(`/dashboard/trade?asset=${tradeSymbol}&action=${action}`);
  };

  const onChartMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(series.length - 1, Math.round(frac * (series.length - 1))));
    setHoverIdx(idx);
  };

  /* ── misc render helpers ── */
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const [balWhole, balCents] = fmt(balance).split('.');
  const activeMethod = depositMethods.find(m => m.id === method);
  const posTotal = profitPos + lossPos;

  const tagColors: Record<string, [string, string]> = {
    CRYPTO:      ['var(--acc-soft)', 'var(--acc)'],
    FOREX:       ['var(--pos-soft)', 'var(--pos)'],
    STOCKS:      ['#20293f', '#8ab4ff'],
    MACRO:       ['var(--gold-soft)', 'var(--gold)'],
    COMMODITIES: ['var(--neg-soft)', '#ff8a5c'],
  };

  const chartColor = isProfitable ? 'var(--pos)' : 'var(--neg)';
  const hi = hoverIdx !== null && series.length ? hoverIdx : null;

  if (loading) {
    return (
      <div className="dash-v2 v2-loading-wrap">
        <div className="v2-loading">
          <div className="v2-loading-mark">◆</div>
          <div className="v2-spinner" />
          <p>SYNCING DESK…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-v2">

      {/* ══ ticker tape ══ */}
      {markets.length > 0 && (
        <div className="tape" aria-hidden="true">
          <div className="tape-track">
            {[...markets, ...markets].map((m, i) => (
              <span className="tape-item" key={`${m.symbol}-${i}`}>
                <b>{m.symbol}</b>
                <span>${fmt(m.price)}</span>
                <i className={m.changePercent >= 0 ? 'up' : 'dn'}>
                  {m.changePercent >= 0 ? '+' : ''}{fmt(m.changePercent)}%
                </i>
                <em className="tape-sep">◆</em>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══ header ══ */}
      <header className="v2-header">
        <div>
          <p className="v2-eyebrow"><span className="v2-eyebrow-pip" />Apex·Mkts — Trading Desk</p>
          <h1 className="v2-greet">{greet}, <span>{firstName || 'Trader'}</span></h1>
          <div className="v2-meta-row">
            <span className="v2-idchip">UID {userId}</span>
            <span className={`v2-kyc ${kycOk ? 'ok' : 'pending'}`}>
              <span className="v2-kyc-dot" />KYC {kycStatus.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="v2-hdr-right">
          <div className="v2-live"><span className="v2-live-dot" />MARKET LIVE</div>
          <div className="v2-clockbox">
            <span className="v2-clock">{time}</span>
            <span className="v2-date">{dateStr}</span>
          </div>
        </div>
      </header>

      <div className="v2-grid">
        {/* ══════════ MAIN COLUMN ══════════ */}
        <div className="v2-main">

          {/* ── portfolio hero ── */}
          <section className="vcard hero">
            <div className="hero-head">
              <div>
                <p className="hero-eyebrow">Net Asset Value · USD</p>
                <p className="hero-balance">
                  <span className="cur">$</span>{balWhole}<span className="cents">.{balCents}</span>
                </p>
                <div className="hero-chips">
                  <span className={`chip ${isProfitable ? 'pos' : 'neg'}`}>
                    {isProfitable ? '▲' : '▼'} {isProfitable ? '+' : ''}{fmt(profit)} USD
                  </span>
                  <span className={`chip ghost ${isProfitable ? 'pos' : 'neg'}`}>
                    {isProfitable ? '+' : ''}{fmt(changePercent)}% · 24H
                  </span>
                </div>
              </div>
              <div className="period-btns">
                {(['1D', '7D', '1M', '1Y'] as Period[]).map(p => (
                  <button key={p} className={`period-btn ${period === p ? 'on' : ''}`} onClick={() => setPeriod(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="hero-chart" onMouseMove={onChartMove} onMouseLeave={() => setHoverIdx(null)}>
              {chart ? (
                <>
                  <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="nav-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColor} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75].map(f => (
                      <line key={f} x1="0" x2={CHART_W}
                        y1={PAD_T + f * (CHART_H - PAD_T - PAD_B)}
                        y2={PAD_T + f * (CHART_H - PAD_T - PAD_B)}
                        stroke="var(--line)" strokeDasharray="3 6" strokeWidth="1" />
                    ))}
                    <path d={chart.area} fill="url(#nav-fill)" />
                    <path d={chart.line} fill="none" stroke={chartColor} strokeWidth="2"
                      strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    {hi !== null && (
                      <line x1={chart.X(hi)} x2={chart.X(hi)} y1={PAD_T - 6} y2={CHART_H - 4}
                        stroke="var(--line2)" strokeWidth="1" strokeDasharray="2 3" />
                    )}
                    <circle cx={chart.X(series.length - 1)} cy={chart.Y(series[series.length - 1])}
                      r="3.5" fill={chartColor} />
                    <circle className="chart-ping" cx={chart.X(series.length - 1)} cy={chart.Y(series[series.length - 1])}
                      r="3.5" fill="none" stroke={chartColor} strokeWidth="1.5" />
                    {hi !== null && (
                      <circle cx={chart.X(hi)} cy={chart.Y(series[hi])} r="4"
                        fill="var(--bg0)" stroke={chartColor} strokeWidth="2" />
                    )}
                  </svg>
                  <div className="hero-chart-meta">
                    <span>H ${fmt(chart.max, 0)}</span>
                    <span>L ${fmt(chart.min, 0)}</span>
                  </div>
                  {hi !== null && (
                    <div className="chart-tip" style={{
                      left: `${(chart.X(hi) / CHART_W) * 100}%`,
                      top: `${(chart.Y(series[hi]) / CHART_H) * 100}%`,
                      transform: chart.Y(series[hi]) > CHART_H * 0.5 ? 'translate(-50%, 14px)' : 'translate(-50%, -130%)',
                    }}>
                      <em>NAV</em> ${fmt(series[hi], 0)}
                    </div>
                  )}
                </>
              ) : (
                <div className="hero-chart-empty">No balance data to plot yet</div>
              )}
            </div>

            <div className="hero-actions">
              <button className="act-primary" onClick={openDeposit}>＋ Deposit</button>
              <Link to="/dashboard/withdraw" className="act-ghost">Withdraw</Link>
              <Link to="/dashboard/history" className="act-ghost">History</Link>
              <Link to="/dashboard/trade" className="act-link">Open trade →</Link>
            </div>
          </section>

          {/* ── stat strip ── */}
          <section className="vcard stat-strip">
            <div className="stat-cell">
              <p className="stat-lbl"><span className="pip pip-acc" />Realised P&amp;L</p>
              <p className={`stat-val ${isProfitable ? 'pos' : 'neg'}`}>
                {isProfitable ? '+' : ''}{fmt(profit)}
              </p>
              <p className="stat-sub">USD · realised this session</p>
            </div>
            <div className="stat-cell">
              <p className="stat-lbl"><span className="pip pip-pos" />Open Positions</p>
              <p className="stat-val">{openPositions}</p>
              <div className="split-bar">
                <span className="w" style={{ width: posTotal ? `${(profitPos / posTotal) * 100}%` : '50%' }} />
                <span className="l" style={{ width: posTotal ? `${(lossPos / posTotal) * 100}%` : '50%' }} />
              </div>
              <p className="stat-sub">{profitPos} in profit · {lossPos} in loss</p>
            </div>
            <div className="stat-cell">
              <p className="stat-lbl"><span className="pip pip-gold" />Risk Profile</p>
              <p className="stat-val">{riskLabel}</p>
              <div className="risk-bar">
                <span style={{ width: `${Math.min(100, volatility)}%` }} />
              </div>
              <p className="stat-sub">Volatility {fmt(volatility, 1)}%</p>
            </div>
            <div className="stat-cell stat-cell-fg">
              <p className="stat-lbl stat-lbl-c"><span className="pip pip-neg" />Sentiment</p>
              <FearGreedGauge value={fearGreedValue} />
            </div>
          </section>

          {/* ── markets board ── */}
          <section className="vcard mkt-card">
            <div className="mkt-head">
              <p className="section-title"><span className="pip pip-acc" />Market Board</p>
              <div className="mkt-tabs">
                {(['watch', 'gainers', 'losers'] as MktTab[]).map(t => (
                  <button key={t} className={`mkt-tab ${mktTab === t ? 'on' : ''}`} onClick={() => setMktTab(t)}>
                    {t === 'watch' ? 'Watchlist' : t === 'gainers' ? '↑ Gainers' : '↓ Losers'}
                  </button>
                ))}
              </div>
              <Link to="/dashboard/markets" className="section-view-all">All markets →</Link>
            </div>
            <div className="mkt-rows">
              {rowsByTab.length === 0 ? (
                <p className="mkt-empty">
                  {markets.length === 0 ? 'No market data available'
                    : mktTab === 'gainers' ? 'Everything is red right now'
                    : 'Everything is green right now'}
                </p>
              ) : rowsByTab.map(m => {
                const up = m.changePercent >= 0;
                return (
                  <div className="mkt-row" key={m.symbol}>
                    <div className="mkt-asset">
                      <div className="mkt-logo">
                        {m.logoUrl && (
                          <img src={m.logoUrl} alt={m.symbol}
                            onError={e => e.currentTarget.parentElement?.classList.add('broken')} />
                        )}
                        <span className="mkt-logo-fb">{m.symbol.slice(0, 2)}</span>
                      </div>
                      <div className="mkt-meta">
                        <p className="mkt-sym">{m.symbol}</p>
                        <p className="mkt-name">{m.name}</p>
                      </div>
                    </div>
                    <div className="mkt-spark"><MiniSpark positive={up} seed={symSeed(m.symbol)} /></div>
                    <p className={`mkt-price ${flash[m.symbol] === 'up' ? 'flash-up' : flash[m.symbol] === 'dn' ? 'flash-dn' : ''}`}>
                      ${fmt(m.price)}
                    </p>
                    <span className={`mkt-chg ${up ? 'up' : 'dn'}`}>
                      {up ? '+' : ''}{fmt(m.changePercent)}%
                    </span>
                    <div className="mkt-btns">
                      <button className="qbuy" onClick={() => handleQuickTrade(m.symbol, 'BUY')}>Buy</button>
                      <button className="qsell" onClick={() => handleQuickTrade(m.symbol, 'SELL')}>Sell</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ══════════ SIDE COLUMN ══════════ */}
        <div className="v2-side">

          {/* quick actions */}
          <section className="vcard">
            <div className="qa-grid">
              <button className="qa-tile" onClick={openDeposit}>
                <span className="qa-ico">＋</span>Deposit
              </button>
              <Link className="qa-tile" to="/dashboard/withdraw">
                <span className="qa-ico">↑</span>Withdraw
              </Link>
              <Link className="qa-tile" to="/dashboard/trade">
                <span className="qa-ico">⇄</span>Trade
              </Link>
              <Link className="qa-tile" to="/dashboard/history">
                <span className="qa-ico">☰</span>History
              </Link>
            </div>
          </section>

          {/* activity timeline */}
          <section className="vcard">
            <div className="side-head">
              <p className="section-title"><span className="pip pip-pos" />Recent Activity</p>
              <Link to="/dashboard/history" className="section-view-all">All →</Link>
            </div>
            <div className="act-list">
              {activityLogs.length === 0
                ? <p className="act-empty">No recent activity</p>
                : activityLogs.slice(0, 5).map(a => (
                  <p key={a.id} className="act-item">{a.description}</p>
                ))}
            </div>
          </section>

          {/* news */}
          <section className="vcard news-card">
            <div className="side-head">
              <p className="section-title"><span className="pip pip-gold" />Global Finance News</p>
            </div>
            <div className="news-wrap">
              {newsLoading ? (
                <div className="news-loading">
                  <div className="v2-spinner small" />
                  <p>Fetching latest news…</p>
                </div>
              ) : news.length === 0 ? (
                <p className="news-none">No news available.</p>
              ) : (
                <>
                  {news.map((item, i) => {
                    const [tagBg, tagCol] = tagColors[item.tag] ?? ['var(--bg3)', 'var(--tx2)'];
                    const isExpanded = expandedNewsIdx === i;
                    return (
                      <div key={i} className="news-entry">
                        <div className="news-item" onClick={() => setExpandedNewsIdx(isExpanded ? null : i)}>
                          <span className="news-tag" style={{ background: tagBg, color: tagCol }}>{item.tag}</span>
                          <div className="news-body">
                            <p className="news-headline">{item.headline}</p>
                            <p className="news-meta">{item.source} · {item.time}</p>
                          </div>
                          <span className={`news-chev ${isExpanded ? 'open' : ''}`}>▾</span>
                        </div>
                        {isExpanded && (
                          <div className="news-expand">
                            {item.summary
                              ? <p className="news-summary">{item.summary}</p>
                              : <p className="news-summary empty">No summary available.</p>}
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
                    <span>Live · CryptoCompare &amp; BBC Business</span>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ══ deposit sheet ══ */}
      {sheet === 'deposit' && (
        <>
          <div className="sheet-overlay" onClick={closeSheet} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-head">
              <div>
                <p className="sheet-title">Quick Deposit</p>
                <p className="sheet-sub">Copy an address and make an instant deposit</p>
              </div>
              <button className="sheet-close" onClick={closeSheet}>✕</button>
            </div>

            {methodsLoading ? (
              <div className="sheet-loading">
                <div className="v2-spinner" />
                <p>Loading methods…</p>
              </div>
            ) : depositMethods.length === 0 ? (
              <div className="sheet-empty">
                <p className="sheet-empty-ico">🔧</p>
                <p className="sheet-empty-title">No deposit methods yet</p>
                <p className="sheet-empty-sub">Contact support or check back later.</p>
              </div>
            ) : (
              <>
                <div className="method-pills-row">
                  {depositMethods.map(m => (
                    <MethodPill key={m.id} m={m} active={method === m.id} onClick={() => setMethod(m.id)} />
                  ))}
                </div>

                {activeMethod && (
                  <div className="addr-box">
                    <div className="addr-method-header">
                      {activeMethod.logoUrl && (
                        <img src={activeMethod.logoUrl} alt={activeMethod.label} className="addr-method-logo"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <div>
                        <p className="addr-method-name">{activeMethod.label}</p>
                        {activeMethod.network && <p className="addr-network">Network · {activeMethod.network}</p>}
                      </div>
                    </div>
                    <p className="addr-text">{activeMethod.address}</p>
                    <button onClick={() => copyAddress(activeMethod.address)}
                      className={`copy-btn ${copied ? 'done' : 'idle'}`}>
                      {copied ? '✓ Copied to clipboard' : '⧉ Copy Address'}
                    </button>
                  </div>
                )}
                {activeMethod?.note && (
                  <div className="note-box">
                    <span>⚠️</span>
                    <p>{activeMethod.note}</p>
                  </div>
                )}
              </>
            )}
            <Link to="/dashboard/deposit" className="sheet-full-link" onClick={closeSheet}>
              Continue to Deposit →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
