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
  };
  transactions: Transaction[];
  positions: { open: number; profit: number; loss: number };
  notifications: { id: string; message: string; read: boolean }[];
  activityLogs: { id: string; description: string }[];
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

export default function DashboardOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('7D');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mktTab, setMktTab] = useState<MktTab>('watch');
  const [flash, setFlash] = useState<Record<string, 'up' | 'dn'>>({});
  const [feed, setFeed] = useState<'live' | 'sync'>('sync');
  const prevPrices = useRef<Record<string, number>>({});

  /* ── user dashboard (unchanged endpoint) ── */
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/user/dashboard', { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, []);

  /* ── market list via backend, with browser-side rescue ── */
  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          setMarkets(list);
          setFeed('live');
          return;
        }
      }
    } catch {}

    /* last-resort rescue: browser → CoinGecko */
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true'
      );
      if (res.ok) {
        const d = await res.json();
        const rows = [
          { symbol: 'BTC', name: 'Bitcoin',  id: 'bitcoin',     logoUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
          { symbol: 'ETH', name: 'Ethereum', id: 'ethereum',    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
          { symbol: 'SOL', name: 'Solana',   id: 'solana',      logoUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
          { symbol: 'BNB', name: 'BNB',      id: 'binancecoin', logoUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
        ]
          .map(r => ({ symbol: r.symbol, name: r.name, logoUrl: r.logoUrl, price: d[r.id]?.usd ?? 0, changePercent: d[r.id]?.usd_24h_change ?? 0 }))
          .filter(r => r.price > 0);
        if (rows.length) {
          setMarkets(rows);
          setFeed('live');
          return;
        }
      }
    } catch {}

    setFeed('sync');
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchMarkets();
    const id = setInterval(fetchMarkets, 30_000);
    return () => clearInterval(id);
  }, [fetchDashboard, fetchMarkets]);

  /* ── price flash on backend updates ── */
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
  const openPositions = data?.positions.open ?? 0;
  const profitPos     = data?.positions.profit ?? 0;
  const lossPos       = data?.positions.loss ?? 0;
  const activityLogs  = data?.activityLogs ?? [];
  const transactions  = data?.transactions ?? [];
  const profit        = data?.user.realisedPnl ?? 0;
  const changePercent = data?.user.portfolioChangePercent ?? 0;
  const volatility    = data?.user.volatility ?? 0;
  const riskLabel     = data?.user.riskLabel ?? '—';
  const isProfitable  = profit >= 0;

  /* ── NAV chart series (flat baseline when no balance yet) ── */
  const series = useMemo(() => {
    const cfg = PERIOD_CFG[period];
    if (!balance) return Array.from({ length: cfg.pts + 1 }, () => 0);
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
    const flat = max === min;
    const span = max - min || 1;
    const X = (i: number) => (i / (series.length - 1)) * CHART_W;
    const Y = (v: number) =>
      flat
        ? (CHART_H + PAD_T - PAD_B) / 2
        : PAD_T + (1 - (v - min) / span) * (CHART_H - PAD_T - PAD_B);
    const pts = series.map((v, i) => ({ x: X(i), y: Y(v) }));
    const line = smoothPath(pts);
    const area = `${line} L ${CHART_W} ${CHART_H} L 0 ${CHART_H} Z`;
    return { min, max, flat, X, Y, line, area };
  }, [series]);

  const topGainers = [...markets].filter(m => m.changePercent >= 0)
    .sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const topLosers = [...markets].filter(m => m.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

  const rowsByTab: Market[] =
    mktTab === 'watch'
      ? WATCH_SYMS.map(s => markets.find(m => m.symbol === s)).filter((m): m is Market => Boolean(m))
      : mktTab === 'gainers' ? topGainers : topLosers;

  const handleQuickTrade = (symbol: string, action: 'BUY' | 'SELL') => {
    const tradeSymbol = CRYPTO_SYMS.includes(symbol) ? `${symbol}USD` : symbol;
    navigate(`/dashboard/trade?asset=${tradeSymbol}&action=${action}`);
  };

  const onChartMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chart || chart.flat) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(series.length - 1, Math.round(frac * (series.length - 1))));
    setHoverIdx(idx);
  };

  const [balWhole, balCents] = fmt(balance).split('.');
  const posTotal = profitPos + lossPos;
  const chartColor = chart?.flat ? 'var(--tx3)' : isProfitable ? 'var(--pos)' : 'var(--neg)';
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
              {chart && (
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
                    {!chart.flat && <path d={chart.area} fill="url(#nav-fill)" />}
                    <path d={chart.line} fill="none" stroke={chartColor} strokeWidth="2"
                      strokeLinecap="round" vectorEffect="non-scaling-stroke"
                      strokeDasharray={chart.flat ? '5 7' : undefined} />
                    {hi !== null && !chart.flat && (
                      <line x1={chart.X(hi)} x2={chart.X(hi)} y1={PAD_T - 6} y2={CHART_H - 4}
                        stroke="var(--line2)" strokeWidth="1" strokeDasharray="2 3" />
                    )}
                    <circle cx={chart.X(series.length - 1)} cy={chart.Y(series[series.length - 1])}
                      r="3.5" fill={chartColor} />
                    <circle className="chart-ping" cx={chart.X(series.length - 1)} cy={chart.Y(series[series.length - 1])}
                      r="3.5" fill="none" stroke={chartColor} strokeWidth="1.5" />
                    {hi !== null && !chart.flat && (
                      <circle cx={chart.X(hi)} cy={chart.Y(series[hi])} r="4"
                        fill="var(--bg0)" stroke={chartColor} strokeWidth="2" />
                    )}
                  </svg>
                  {!chart.flat && (
                    <div className="hero-chart-meta">
                      <span>H ${fmt(chart.max, 0)}</span>
                      <span>L ${fmt(chart.min, 0)}</span>
                    </div>
                  )}
                  {hi !== null && !chart.flat && (
                    <div className="chart-tip" style={{
                      left: `${(chart.X(hi) / CHART_W) * 100}%`,
                      top: `${(chart.Y(series[hi]) / CHART_H) * 100}%`,
                      transform: chart.Y(series[hi]) > CHART_H * 0.5 ? 'translate(-50%, 14px)' : 'translate(-50%, -130%)',
                    }}>
                      <em>NAV</em> ${fmt(series[hi], 0)}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* ── quick actions (directly after hero) ── */}
          <section className="vcard">
            <div className="qa-grid">
              <Link className="qa-tile" to="/dashboard/deposit"><span className="qa-ico">＋</span>Deposit</Link>
              <Link className="qa-tile" to="/dashboard/withdraw"><span className="qa-ico">↑</span>Withdraw</Link>
              <Link className="qa-tile" to="/dashboard/trade"><span className="qa-ico">⇄</span>Trade</Link>
              <Link className="qa-tile" to="/dashboard/history"><span className="qa-ico">☰</span>History</Link>
            </div>
          </section>

          {/* ── stat strip (3 cells) ── */}
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
          </section>

          {/* ── market board (live) ── */}
          <section className="vcard mkt-card">
            <div className="mkt-head">
              <p className="section-title"><span className="pip pip-acc" />Market Board</p>
              <span className={`mkt-live ${feed === 'live' ? 'on' : 'off'}`}>
                <span className="dot" />{feed === 'live' ? 'LIVE FEED' : 'SYNCING'}
              </span>
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
                  {markets.length === 0 ? 'Connecting to market feed…'
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

          {/* transactions */}
          <section className="vcard">
            <div className="side-head">
              <p className="section-title"><span className="pip pip-gold" />Transactions</p>
              <Link to="/dashboard/history" className="section-view-all">All →</Link>
            </div>
            <div className="tx-list">
              {transactions.length === 0 ? (
                <p className="act-empty" style={{ padding: '12px 17px' }}>No transactions yet</p>
              ) : transactions.slice(0, 6).map(t => {
                const when = (() => {
                  const d = new Date(t.createdAt);
                  if (isNaN(d.getTime())) return '';
                  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                })();
                return (
                  <div className="tx-item" key={t.id}>
                    <div className={`tx-ico ${t.type.toLowerCase()}`}>
                      {t.type === 'Deposit' ? '↓' : t.type === 'Withdrawal' ? '↑' : '⇄'}
                    </div>
                    <div className="tx-meta">
                      <p className="tx-title">{t.type} · {t.asset}</p>
                      <p className="tx-date">{when}</p>
                    </div>
                    <div className="tx-right">
                      <p className={`tx-amt ${t.type === 'Deposit' ? 'pos' : t.type === 'Withdrawal' ? 'neg' : ''}`}>
                        {t.type === 'Withdrawal' ? '-' : t.type === 'Deposit' ? '+' : ''}{fmt(t.amount)}
                      </p>
                      <span className={`tx-status ${t.status.toLowerCase()}`}>{t.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
