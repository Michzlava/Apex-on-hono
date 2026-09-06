import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './landing-page.css';

const ASSETS = [
  { id: 'BTC',  sym: 'Bitcoin',  tag: 'BTC / USD', color: '#f7931a', icon: 'https://assets.coincap.io/assets/icons/btc@2x.png' },
  { id: 'ETH',  sym: 'Ethereum', tag: 'ETH / USD', color: '#627eea', icon: 'https://assets.coincap.io/assets/icons/eth@2x.png' },
  { id: 'XAU',  sym: 'Gold',     tag: 'XAU / USD', color: '#d4af37', icon: 'https://assets.coincap.io/assets/icons/xaut@2x.png' },
  { id: 'EUR',  sym: 'Euro',     tag: 'EUR / USD', color: '#3b82f6' },
  { id: 'AAPL', sym: 'Apple',    tag: 'AAPL',      color: '#94a3b8' },
  { id: 'TSLA', sym: 'Tesla',    tag: 'TSLA',      color: '#ef4444' },
];

type Asset = { id: string; sym: string; tag: string; color: string; icon?: string; price: number; change: number };

function Sparkline({ positive }: { positive: boolean }) {
  const pts = positive
    ? '0,20 14,14 28,17 42,9 56,12 70,4 84,7 98,0'
    : '0,2 14,9 28,6 42,15 56,11 70,20 84,16 98,22';
  return (
    <svg width={100} height={24} viewBox="0 0 98 24" fill="none">
      <polyline
        points={pts}
        stroke={positive ? '#34d399' : '#fb7185'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

function HeroMiniChart({ label, value, change, positive }: {
  label: string; value: string; change: string; positive: boolean;
}) {
  const points = positive
    ? 'M0,28 L21,22 L43,25 L64,14 L85,18 L107,8 L128,4'
    : 'M0,4 L21,10 L43,7 L64,16 L85,13 L107,22 L128,26';
  const col = positive ? '#34d399' : '#fb7185';
  return (
    <div className="lp-hero-mini">
      <div className="lp-hero-mini-head">
        <span className="lp-hero-mini-lbl">{label}</span>
        <span className={`lp-hero-mini-chg ${positive ? 'pos' : 'neg'}`}>{change}</span>
      </div>
      <div className="lp-hero-mini-val">{value}</div>
      <svg width="128" height="32" viewBox="0 0 128 32" fill="none">
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity="0.3" />
            <stop offset="100%" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={points + ' L128,32 L0,32 Z'} fill={`url(#grad-${label})`} />
        <path d={points} stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </div>
  );
}

export default function LandingPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const fetchPrices = async () => {
    const results = await Promise.all(
      ASSETS.map(async (a) => {
        try {
          const res = await fetch(`/api/price?symbol=${a.id}`);
          const data = await res.json();
          return { ...a, price: data.price ?? 0, change: (Math.random() - 0.38) * 3.5 };
        } catch {
          return { ...a, price: 0, change: 0 };
        }
      })
    );
    setAssets(results);
  };

  useEffect(() => {
    fetchPrices();
    const t = setInterval(fetchPrices, 51000);
    return () => clearInterval(t);
  }, []);

  const bids = [
    { price: '104,218.50', size: '0.4821', depth: 82 },
    { price: '104,210.00', size: '1.2034', depth: 68 },
    { price: '104,198.75', size: '0.8812', depth: 55 },
  ];
  const asks = [
    { price: '104,225.00', size: '0.5500', depth: 75 },
    { price: '104,237.50', size: '0.9200', depth: 60 },
    { price: '104,250.75', size: '1.4400', depth: 48 },
  ];

  return (
    <div className="lp-wrap">
      {/* ── Nav ── */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav-solid' : ''}`}>
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">
            <div className="lp-logo-box">AP</div>
            <span className="lp-logo-text">APEX<span>·</span>MKTS</span>
          </Link>

          <div className="lp-nav-links">
            <a href="#markets">Markets</a>
            <a href="#features">Features</a>
            <a href="#security">Security</a>
          </div>

          <div className="lp-nav-actions">
            <Link to="/login" className="lp-nav-signin">Sign In</Link>
            <Link to="/signup" className="lp-nav-cta">Get Started</Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-hero-glow lp-hero-glow-1" />
          <div className="lp-hero-glow lp-hero-glow-2" />

          <div className="lp-hero-grid">
            {/* Left */}
            <div className="lp-hero-left">
              <div className="lp-hero-badge anim-a1">
                <span className="lp-hero-badge-dot" />
                <span>LIVE MARKETS · MULTI-ASSET</span>
              </div>

              <h1 className="lp-hero-title anim-a2">
                Multiple markets.<br />
                <span className="accent">One portfolio.</span>
              </h1>

              <p className="lp-hero-sub anim-a3">
                Trade cryptocurrency, forex, equities, and commodities from a single account with real-time analytics.
              </p>

              {/* Live price pills */}
              <div className="lp-hero-pills anim-a3">
                {assets.slice(0, 4).map(a => (
                  <div key={a.id} className="lp-pill">
                    {a.icon ? (
                      <img src={a.icon} alt={a.id} className="lp-pill-ico" />
                    ) : (
                      <div className="lp-pill-fb" style={{ background: `${a.color}22`, color: a.color }}>
                        {a.id.slice(0, 2)}
                      </div>
                    )}
                    <span className="lp-pill-sym">{a.id}</span>
                    <span className={`lp-pill-chg ${a.change >= 0 ? 'pos' : 'neg'}`}>
                      {a.change >= 0 ? '+' : ''}{a.change.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>

              <div className="lp-hero-btns anim-a4">
                <Link to="/signup" className="lp-btn-primary">Create Account</Link>
                <Link to="/login" className="lp-btn-ghost">Sign In →</Link>
              </div>

              <div className="lp-hero-stats anim-a5">
                {[['$4.2B', 'Volume'], ['99.9%', 'Uptime'], ['180K+', 'Traders'], ['200+', 'Instruments']].map(([v, l]) => (
                  <div key={l} className="lp-stat">
                    <div className="lp-stat-val">{v}</div>
                    <div className="lp-stat-lbl">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — trading card */}
            <div className="lp-hero-right anim-aRight">
              <div className="lp-hero-float lp-float-2">
                <HeroMiniChart
                  label="ETH / USD"
                  value="$3,821.40"
                  change="+2.14%"
                  positive={true}
                />
              </div>
              <div className="lp-hero-float lp-float-1">
                <HeroMiniChart
                  label="EUR / USD"
                  value="$1.0842"
                  change="-0.32%"
                  positive={false}
                />
              </div>

              <div className="lp-card">
                {/* Card header */}
                <div className="lp-card-head">
                  <div className="lp-card-head-left">
                    <img src="https://assets.coincap.io/assets/icons/btc@2x.png" className="lp-card-ico" alt="BTC" />
                    <div>
                      <span className="lp-card-pair">BTC / USD</span>
                      <span className="lp-card-tag">CRYPTO · PERPETUAL</span>
                    </div>
                  </div>
                  <span className="lp-card-live">
                    <span className="lp-live-dot" />Live
                  </span>
                </div>

                {/* Price */}
                <div className="lp-card-price">
                  <div className="lp-card-price-row">
                    <span className="lp-card-price-val">
                      {assets[0]?.price > 0
                        ? `$${assets[0].price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '$104,218.50'}
                    </span>
                    <span className="lp-card-price-chg">+1.84%</span>
                  </div>
                  <div className="lp-card-stats">
                    {[['24H High', '$106,400'], ['24H Low', '$102,100'], ['Volume', '$4.2B']].map(([l, v]) => (
                      <div key={l}>
                        <div className="lp-card-stat-lbl">{l}</div>
                        <div className="lp-card-stat-val">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chart */}
                <div className="lp-card-chart">
                  <svg width="100%" height="56" viewBox="0 0 320 56" preserveAspectRatio="none" fill="none">
                    <defs>
                      <linearGradient id="btcGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,48 L32,38 L64,42 L96,24 L128,30 L160,16 L192,20 L224,8 L256,12 L288,4 L320,8 L320,56 L0,56 Z" fill="url(#btcGrad)" />
                    <path d="M0,48 L32,38 L64,42 L96,24 L128,30 L160,16 L192,20 L224,8 L256,12 L288,4 L320,8" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="320" y1="8" x2="320" y2="56" stroke="#34d399" strokeWidth="1" strokeDasharray="3,3" opacity="0.3" />
                    <circle cx="320" cy="8" r="3" fill="#34d399" opacity="0.8" />
                  </svg>
                </div>

                {/* Order book */}
                <div className="lp-card-book">
                  <div className="lp-card-book-title">Order Book</div>

                  {asks.slice(0, 3).map((ask, i) => (
                    <div key={i} className="lp-book-row lp-book-ask">
                      <div className="lp-book-bar" style={{ width: `${ask.depth}%` }} />
                      <span className="lp-book-price">{ask.price}</span>
                      <span className="lp-book-size">{ask.size}</span>
                    </div>
                  ))}

                  <div className="lp-book-spread">
                    <span>Spread: $6.50 · 0.006%</span>
                  </div>

                  {bids.slice(0, 3).map((bid, i) => (
                    <div key={i} className="lp-book-row lp-book-bid">
                      <div className="lp-book-bar" style={{ width: `${bid.depth}%` }} />
                      <span className="lp-book-price">{bid.price}</span>
                      <span className="lp-book-size">{bid.size}</span>
                    </div>
                  ))}
                </div>

                {/* Quick trade */}
                <div className="lp-card-actions">
                  <button className="lp-trade-btn lp-trade-buy">▲ BUY LONG</button>
                  <button className="lp-trade-btn lp-trade-sell">▼ SELL SHORT</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Ticker ── */}
        <div className="lp-ticker">
          <div className="lp-ticker-track">
            {[...assets, ...assets, ...assets].map((a, i) => (
              <div key={i} className="lp-ticker-item">
                <span className="lp-ticker-tag">{a.tag}</span>
                <span className="lp-ticker-price">
                  {a.price > 0 ? `$${a.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
                <span className={`lp-ticker-chg ${a.change >= 0 ? 'pos' : 'neg'}`}>
                  {a.change >= 0 ? '+' : ''}{a.change.toFixed(2)}%
                </span>
                <span className="lp-ticker-sep">·</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Markets ── */}
        <section id="markets" className="lp-section">
          <div className="lp-section-head">
            <p className="lp-eyebrow">Markets</p>
            <h2 className="lp-h2">All markets, one account</h2>
            <p className="lp-section-sub">
              Access crypto, forex pairs, equities, and commodities — all priced in real time with tight spreads.
            </p>
          </div>

          <div className="lp-table">
            <div className="lp-table-head">
              <span>Asset</span>
              <span>Price</span>
              <span>24h Change</span>
              <span className="trend-head">Trend</span>
            </div>

            {assets.map((a, i) => (
              <div key={a.id} className={`lp-table-row ${i === assets.length - 1 ? 'last' : ''}`}>
                <div className="lp-asset-cell">
                  {a.icon ? (
                    <img src={a.icon} alt={a.id} className="lp-asset-ico" />
                  ) : (
                    <div className="lp-asset-fb" style={{ background: `${a.color}18`, color: a.color }}>
                      {a.id.slice(0, 3)}
                    </div>
                  )}
                  <div>
                    <div className="lp-asset-sym">{a.sym}</div>
                    <div className="lp-asset-tag">{a.tag}</div>
                  </div>
                </div>
                <div className="lp-asset-price">
                  {a.price > 0 ? `$${a.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="lp-muted">—</span>}
                </div>
                <div>
                  <span className={`lp-chg-badge ${a.change >= 0 ? 'pos' : 'neg'}`}>
                    {a.change >= 0 ? '+' : ''}{a.change.toFixed(2)}%
                  </span>
                </div>
                <div className="trend-col"><Sparkline positive={a.change >= 0} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="lp-section lp-section-features">
          <div className="lp-inner">
            <div className="lp-section-head">
              <p className="lp-eyebrow">Platform</p>
              <h2 className="lp-h2">Razor thin spreads</h2>
            </div>

            <div className="lp-feat-grid">
              {[
                { label: 'Execution Speed', body: 'Trades settle in milliseconds across all asset classes. No slippage, no surprises.' },
                { label: 'Security', body: 'Bank-grade encryption, 2FA, KYC verification, and cold-storage asset custody.' },
                { label: 'Advanced Charting', body: 'Multi-timeframe charts with 80+ technical indicators across every instrument.' },
                { label: '200+ Instruments', body: 'Crypto, major and exotic forex pairs, US equities, indices, and commodities.' },
                { label: 'Transparent Fees', body: 'No hidden commissions. Tight spreads and straightforward pricing on every trade.' },
                { label: 'Unified Portfolio', body: 'One dashboard. Complete visibility across all your positions in real time.' },
              ].map(f => (
                <div key={f.label} className="lp-feat-card">
                  <div className="lp-feat-label">{f.label}</div>
                  <div className="lp-feat-body">{f.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Security ── */}
        <section id="security" className="lp-security">
          <div className="lp-security-inner">
            <div>
              <p className="lp-security-title">Your assets are protected</p>
              <p className="lp-security-sub">Industry-standard safeguards across every layer.</p>
            </div>
            <div className="lp-security-badges">
              {['SSL / TLS Encrypted', 'KYC Verified', 'Cold Storage', '2FA Required', 'GDPR Compliant'].map(s => (
                <span key={s} className="lp-security-badge">{s}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Steps ── */}
        <section className="lp-steps-wrap">
          <div className="lp-section-head">
            <p className="lp-eyebrow">Getting Started</p>
            <h2 className="lp-h2">Start trading in 3 steps</h2>
          </div>

          <div className="lp-steps">
            {[
              { n: '01', title: 'Create Your Account', desc: 'Sign up and complete identity verification in under two minutes.' },
              { n: '02', title: 'Fund Your Portfolio', desc: 'Deposit via crypto, bank transfer, or card. Reflected in your dashboard instantly.' },
              { n: '03', title: 'Trade Global Markets', desc: 'Access every instrument from your professional dashboard, live.' },
            ].map((s, i, arr) => (
              <div key={s.n} className={`lp-step ${i < arr.length - 1 ? 'bordered' : ''}`}>
                <div className="lp-step-n">{s.n}</div>
                <div>
                  <div className="lp-step-title">{s.title}</div>
                  <div className="lp-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta-wrap">
          <div className="lp-cta">
            <p className="lp-eyebrow">Ready to trade?</p>
            <h2 className="lp-cta-title">Join 180,000+ traders worldwide</h2>
            <p className="lp-cta-sub">
              Access crypto, forex, stocks, and commodities from one secure, professional platform. Free to start.
            </p>
            <Link to="/signup" className="lp-cta-btn">Create Free Account →</Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="lp-footer">
          <div className="lp-footer-top">
            <div>
              <div className="lp-footer-brand">APEX · MKTS</div>
              <p className="lp-footer-tag">
                Multi-asset trading platform for crypto, forex, stocks, and commodities.
              </p>
            </div>
            <div className="lp-footer-cols">
              {[
                { title: 'Platform', links: ['Markets', 'Features', 'Security', 'Pricing'] },
                { title: 'Legal', links: ['Privacy Policy', 'Terms of Use', 'Risk Disclosure', 'AML Policy'] },
              ].map(col => (
                <div key={col.title}>
                  <div className="lp-footer-col-title">{col.title}</div>
                  <div className="lp-footer-col-links">
                    {col.links.map(l => <span key={l} className="lp-footer-link">{l}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-footer-bottom">
            <p>© 2026 Apex Markets. All rights reserved.</p>
            <p>Trading involves risk. Only invest what you can afford to lose.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
