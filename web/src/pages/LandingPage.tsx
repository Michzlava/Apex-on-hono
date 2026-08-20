import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import  Logo  from '../components/Logo';
import './landing.css';

/* ─── Data Generation & Fallbacks ───────────────────────────────── */
function makeCandles(n = 58) {
  let price = 67000;
  return Array.from({ length: n }, () => {
    const drift = (Math.random() - 0.47) * 700;
    const open = price;
    const close = price + drift;
    const high = Math.max(open, close) + Math.random() * 260;
    const low  = Math.min(open, close) - Math.random() * 210;
    price = close;
    return { open, close, high, low };
  });
}

const TICKERS = [
  { sym: 'BTC/USD', price: '67,420', chg: '+2.38%', up: true  },
  { sym: 'ETH/USD', price: '3,512',  chg: '+3.01%', up: true  },
  { sym: 'AAPL',    price: '189.42', chg: '+1.24%', up: true  },
  { sym: 'TSLA',    price: '248.10', chg: '−0.87%', up: false },
  { sym: 'EUR/USD', price: '1.0842', chg: '+0.12%', up: true  },
  { sym: 'NVDA',    price: '875.40', chg: '+4.62%', up: true  },
  { sym: 'GOLD',    price: '2,318',  chg: '−0.23%', up: false },
  { sym: 'S&P 500', price: '5,241',  chg: '+0.56%', up: true  },
];

const MARKETS = [
  { sym: 'BTC',     name: 'Bitcoin',       price: '67,420',   chg: '+2.38%', up: true  },
  { sym: 'ETH',     name: 'Ethereum',      price: '3,512',    chg: '+3.01%', up: true  },
  { sym: 'NVDA',    name: 'NVIDIA Corp',   price: '875.40',   chg: '+4.62%', up: true  },
  { sym: 'GOLD',    name: 'Gold Spot',     price: '2,318.50', chg: '−0.23%', up: false },
  { sym: 'EUR/USD', name: 'Euro / Dollar', price: '1.0842',   chg: '+0.12%', up: true  },
  { sym: 'TSLA',    name: 'Tesla Inc',     price: '248.10',   chg: '−0.87%', up: false },
];

const FEATURES = [
  { n: '01', title: 'Smart Order Routing',        desc: 'Real-time splitting across liquidity pools minimises slippage and maximises fill rates on every trade.' },
  { n: '02', title: 'Multi-Asset Dashboard',      desc: 'Equities, crypto, FX, and commodities — one unified workspace, live updates, zero context-switching.' },
  { n: '03', title: 'Real-time Risk Engine',      desc: 'Automatic margin alerts and drawdown controls so you stay in the game longer, with less friction.' },
  { n: '04', title: 'Institutional-grade API',    desc: 'REST + WebSocket access for algorithmic traders. Co-location options with sub-millisecond data feeds.' },
];

/* ─── Candlestick Chart Component ───────────────────────────────── */
function CandleChart({ candles }: { candles: { open: number; close: number; high: number; low: number }[] }) {
  const W = 1100, H = 200;
  const stride = Math.floor(W / candles.length);
  const bw = Math.max(stride - 4, 4);
  const minP = Math.min(...candles.map(c => c.low));
  const maxP = Math.max(...candles.map(c => c.high));
  const range = maxP - minP || 1;
  const pad = { t: 12, b: 10 };
  const toY = (p: number) => pad.t + ((maxP - p) / range) * (H - pad.t - pad.b);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cfh" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor="#070B14" stopOpacity="1"/>
          <stop offset="12%"  stopColor="#070B14" stopOpacity="0"/>
          <stop offset="88%"  stopColor="#070B14" stopOpacity="0"/>
          <stop offset="100%" stopColor="#070B14" stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="cfv" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor="#070B14" stopOpacity="0.85"/>
          <stop offset="55%" stopColor="#070B14" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {candles.map((c, i) => {
        const cx  = i * stride + stride / 2;
        const up  = c.close >= c.open;
        const col = up ? '#00D68A' : '#FF5252';
        const bodyT = toY(Math.max(c.open, c.close));
        const bodyB = toY(Math.min(c.open, c.close));
        const bodyH = Math.max(bodyB - bodyT, 1);
        return (
          <g key={i} opacity="0.82">
            <line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)} stroke={col} strokeWidth="1"/>
            <rect x={i * stride + (stride - bw) / 2} y={bodyT} width={bw} height={bodyH} fill={col}/>
          </g>
        );
      })}
      <rect x="0" y="0" width={W} height={H} fill="url(#cfh)"/>
      <rect x="0" y="0" width={W} height={H} fill="url(#cfv)"/>
    </svg>
  );
}

/* ─── Helper Formatting Utilities ───────────────────────────────── */
const CRYPTO_SET = new Set(['BTC', 'ETH', 'SOL', 'BNB']);

function fmtPrice(price: number) {
  const decimals = price < 1 ? 4 : 2;
  return price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtChange(pct: number) {
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(2)}%`;
}

function displaySym(sym: string) {
  return CRYPTO_SET.has(sym) ? `${sym}/USD` : sym;
}

async function fetchAssets() {
  // In Vite dev, this hits the proxy -> Hono Worker. 
  // In prod, it hits your API domain.
  const res = await fetch('/api/market', { cache: 'no-store' });
  if (!res.ok) throw new Error('market fetch failed');
  return res.json();
}

function buildBook(mid: number) {
  const unit = Math.max(mid * 0.00003, 0.01);
  const level = () => ({ size: (0.25 + Math.random() * 1.1).toFixed(3), pct: Math.round(14 + Math.random() * 38) });
  const asks = Array.from({ length: 5 }, (_, i) => ({ price: fmtPrice(mid + unit * (5 - i)), ...level() }));
  const bids = Array.from({ length: 5 }, (_, i) => ({ price: fmtPrice(mid - unit * (i + 1)), ...level() }));
  return { asks, bids, spread: (unit * 2).toFixed(2), mid: fmtPrice(mid) };
}

/* ─── Main Landing Page Component ────────────────────────────────── */
export default function LandingPage() {
  const [candles] = useState(makeCandles);
  const [assets, setAssets] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchAssets();
        if (active && Array.isArray(data) && data.length) setAssets(data);
      } catch {
        // Keeps fallback UI data safely intact
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const live = assets.length > 0;

  const tickerData = live
    ? assets.map(a => ({ sym: displaySym(a.symbol), price: fmtPrice(a.price), chg: fmtChange(a.changePercent), up: a.changePercent >= 0, logo: a.logoUrl }))
    : TICKERS.map(t => ({ ...t, logo: undefined }));
  const allTickers = [...tickerData, ...tickerData, ...tickerData];

  const marketRows = live
    ? assets.map(a => ({ sym: a.symbol, name: a.name, price: fmtPrice(a.price), chg: fmtChange(a.changePercent), up: a.changePercent >= 0, logo: a.logoUrl }))
    : MARKETS.map(m => ({ ...m, logo: undefined }));

  const btc = assets.find(a => a.symbol === 'BTC');
  const midPrice = btc ? btc.price : 67420.50;
  const midChange = btc ? btc.changePercent : 2.38;
  const btcLogo = btc ? btc.logoUrl : undefined;
  const book = useMemo(() => buildBook(midPrice), [midPrice]);

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('apv'); io.unobserve(e.target); }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.aprx').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="ap-root">

      {/* ── NAV ── */}
      <nav className="ap-nav">
        <Link to="/" className="ap-logo">
          <Logo width={210} height={42} />
        </Link>
        <div className="ap-ticker-wrap">
          <div className="ap-ticker-track">
            {allTickers.map((t, i) => (
              <span key={i} className="ap-ticker-item">
                {t.logo && (
                  <img
                    src={t.logo}
                    alt=""
                    className="ap-tlogo"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <span className="ap-tsym">{t.sym}</span>
                <span className="ap-tprice">{t.price}</span>
                <span className={t.up ? 'ap-up' : 'ap-dn'}>{t.chg}</span>
              </span>
            ))}
          </div>
        </div>
        <ul className="ap-nav-links">
          <li><a href="#platform">Platform</a></li>
          <li><a href="#markets">Markets</a></li>
          <li><a href="#begin">Trust</a></li>
        </ul>
        <Link to="/signup" className="ap-nav-cta">Get Started</Link>
      </nav>

      {/* ── HERO SECTION ── */}
      <section className="ap-hero">
        <div className="ap-hero-grid"/>
        <div className="ap-hero-chart">
          <CandleChart candles={candles}/>
        </div>
        <div className="ap-hero-inner">
          <div className="ap-hero-left">
            <p className="ap-eyebrow">Since 2019 · FCA &amp; CySEC Regulated</p>
            <h1 className="ap-h1">
              YOUR CAPITAL<br/>
              <em>YOUR CALL</em><br/>
              AT ALL TIMES
            </h1>
            <p className="ap-hero-sub ap-text-base">
              Trade equities, crypto, FX, and derivatives from a single platform. Regulated, transparent, and made to handle whatever the market throws at you.
            </p>
            <div className="ap-hero-ctas">
              <Link to="/signup" className="ap-btn-primary">Start Trading →</Link>
              <Link to="/login" className="ap-btn-ghost">Log In</Link>
            </div>
          </div>

          <div className="ap-hero-right">
            <div className="ap-book">
              <div className="ap-book-head">
                <div>
                  <div className="ap-book-pair">
                    {btcLogo && (
                      <img
                        src={btcLogo}
                        alt=""
                        className="ap-book-logo"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <span className="ap-live-dot"/>BTC / USD
                  </div>
                  <div className="ap-book-px">{book.mid}</div>
                  <div className={`ap-book-chg ${midChange >= 0 ? 'ap-up' : 'ap-dn'}`}>
                    {midChange >= 0 ? '▲' : '▼'} {fmtChange(midChange)} today
                  </div>
                </div>
                <div className="ap-book-meta">
                  <div className="ap-meta-item"><span className="ap-ml">Spread</span><span className="ap-mv">{book.spread}</span></div>
                </div>
              </div>
              <div className="ap-book-cols">
                <span>PRICE</span><span className="ap-tc">DEPTH</span><span className="ap-tr">SIZE</span>
              </div>
              {book.asks.map((r, i) => (
                <div className="ap-book-row" key={`ask-${i}`}>
                  <span className="ap-dn">{r.price}</span>
                  <div className="ap-depth"><div className="ap-dfill ap-dask" style={{ width: `${r.pct}%` }}/></div>
                  <span className="ap-bsz">{r.size}</span>
                </div>
              ))}
              <div className="ap-spread">
                <span>SPREAD</span><strong>{book.spread}</strong><span>MID</span><strong>{book.mid}</strong>
              </div>
              {book.bids.map((r, i) => (
                <div className="ap-book-row" key={`bid-${i}`}>
                  <span className="ap-up">{r.price}</span>
                  <div className="ap-depth"><div className="ap-dfill ap-dbid" style={{ width: `${r.pct}%` }}/></div>
                  <span className="ap-bsz">{r.size}</span>
                </div>
              ))}
              <div className="ap-trade-btns">
                <button className="ap-tbtn ap-tbuy">Buy Market</button>
                <button className="ap-tbtn ap-tsell">Sell Market</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKETS SECTION ── */}
      <section className="ap-section ap-mkt-sec" id="markets">
        <div className="ap-mkt-bg">
          <img
            src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1400&auto=format&fit=crop&q=70"
            alt="Global market data network map"
            className="ap-mkt-bg-img"
          />
        </div>
        <div className="ap-mkt-inner aprx">
          <p className="ap-label">02 · Markets</p>
          <h2 className="ap-h2">Everything moves.<br/>Capture it.</h2>
          <p className="ap-body" style={{ maxWidth: '380px', marginBottom: '28px' }}>
            180+ instruments across crypto, equities, FX, and commodities.
          </p>
          <div className="ap-mkt-table">
            <div className="ap-mkt-head">
              <span>Symbol</span><span>Name</span>
              <span className="ap-tr">Price</span><span className="ap-tr">Change</span>
            </div>
            {marketRows.map(m => (
              <div className="ap-mkt-row" key={m.sym}>
                <span className="ap-mkt-sym">
                  {m.logo && (
                    <img
                      src={m.logo}
                      alt=""
                      className="ap-mkt-logo"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  {m.sym}
                </span>
                <span className="ap-mkt-name">{m.name}</span>
                <span className="ap-mkt-price ap-tr">{m.price}</span>
                <span className={`ap-tr ${m.up ? 'ap-up' : 'ap-dn'}`}>{m.chg}</span>
              </div>
            ))}
          </div>
          <Link to="/signup" className="ap-ilink">View all 180+ instruments →</Link>
        </div>
      </section>

      {/* ── PLATFORM SECTION ── */}
      <section className="ap-section" id="platform">
        <div className="ap-platform aprx">
          <div className="ap-plat-text">
            <p className="ap-label">01 · Platform</p>
            <h2 className="ap-h2">Every edge,<br/>engineered.</h2>
            <p className="ap-body">Six years of iteration toward a single goal — zero friction between your signal and the market.</p>
            <div className="ap-feat-list">
              {FEATURES.map(f => (
                <div className="ap-feat-row" key={f.n}>
                  <span className="ap-feat-n">{f.n}</span>
                  <div>
                    <div className="ap-feat-t">{f.title}</div>
                    <div className="ap-feat-d">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ap-plat-media">
            <img
              src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=720&auto=format&fit=crop&q=85"
              alt="Professional trading terminal overview layout"
              className="ap-plat-img"
            />
            <div className="ap-plat-overlay"/>
            <div className="ap-plat-badge">
              <span className="ap-live-dot"/><span>Live execution engine</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CALL TO ACTION SECTION ── */}
      <section className="ap-section ap-begin-sec" id="begin">
        <div className="ap-begin-inner aprx">
          <p className="ap-label">03 · Begin</p>
          <h2 className="ap-h2">Your edge starts here.</h2>
          <p className="ap-body" style={{ marginBottom: '32px' }}>
            Open a funded account in under 5 minutes. No minimums on demo. Live markets from day one.
          </p>
          <div className="ap-cta-form">
            <input className="ap-cta-input" type="email" placeholder="Enter your email address"/>
            <Link to="/signup" className="ap-cta-submit">Get Started</Link>
          </div>
          <div className="ap-trust-badges">
            {['FCA & CySEC regulated', 'Negative balance protection', '24/5 desk support', 'Spreads from 0.0 pips'].map((b, i) => (
              <span key={b}>{i > 0 && <span className="ap-dot">·</span>}{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ap-footer">
        <div className="ap-footer-brand">
          <Logo width={140} height={24} />
        </div>
        <ul className="ap-footer-links">
          {['Web Terminal', 'API Access', 'Careers', 'Privacy', 'Terms', 'Risk Disclosure'].map(l => (
            <li key={l}><a href="#">{l}</a></li>
          ))}
        </ul>
        <span className="ap-footer-legal">© 2026 Apex Markets Ltd. CFDs carry risk. Capital at risk.</span>
      </footer>
    </div>
  );
}
