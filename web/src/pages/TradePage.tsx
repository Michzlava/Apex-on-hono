import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import './trade-page.css';

// ── Types ─────────────────────────────────────────────────────────────
type PriceData = { price: number; change24h: number; volume?: number; high?: number; low?: number };

type Asset = {
  symbol: string;
  name: string;
  type: 'CRYPTO' | 'STOCKS' | 'COMMODITIES' | 'FOREX';
  tvSymbol: string;
  logo?: string;
  icon?: string;
};

type Position = {
  id: string;
  asset: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPnl: number;
  side: 'LONG' | 'SHORT';
  leverage: number;
};

// ── Asset catalog ─────────────────────────────────────────────────────
const ASSETS: Asset[] = [
  { symbol: 'BTCUSD', name: 'Bitcoin',            type: 'CRYPTO',      tvSymbol: 'BINANCE:BTCUSDT',  logo: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png' },
  { symbol: 'ETHUSD', name: 'Ethereum',           type: 'CRYPTO',      tvSymbol: 'BINANCE:ETHUSDT',  logo: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  { symbol: 'SOLUSD', name: 'Solana',             type: 'CRYPTO',      tvSymbol: 'BINANCE:SOLUSDT',  logo: 'https://assets.coingecko.com/coins/images/4128/small/solana.png' },
  { symbol: 'BNBUSD', name: 'BNB',                type: 'CRYPTO',      tvSymbol: 'BINANCE:BNBUSDT',  logo: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png' },
  { symbol: 'AAPL',   name: 'Apple Inc.',         type: 'STOCKS',      tvSymbol: 'NASDAQ:AAPL',      logo: 'https://img.logo.dev/apple.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  { symbol: 'TSLA',   name: 'Tesla, Inc.',        type: 'STOCKS',      tvSymbol: 'NASDAQ:TSLA',      logo: 'https://img.logo.dev/tesla.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  { symbol: 'NVDA',   name: 'NVIDIA Corp.',       type: 'STOCKS',      tvSymbol: 'NASDAQ:NVDA',      logo: 'https://img.logo.dev/nvidia.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  { symbol: 'MSFT',   name: 'Microsoft Corp.',    type: 'STOCKS',      tvSymbol: 'NASDAQ:MSFT',      logo: 'https://img.logo.dev/microsoft.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  { symbol: 'AMZN',   name: 'Amazon.com Inc.',    type: 'STOCKS',      tvSymbol: 'NASDAQ:AMZN',      logo: 'https://img.logo.dev/amazon.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  { symbol: 'GOOGL',  name: 'Alphabet Inc.',      type: 'STOCKS',      tvSymbol: 'NASDAQ:GOOGL',     logo: 'https://img.logo.dev/google.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  { symbol: 'USOIL',  name: 'WTI Crude Oil',      type: 'COMMODITIES', tvSymbol: 'TVC:USOIL',        icon: '🛢' },
  { symbol: 'UKOIL',  name: 'Brent Crude Oil',    type: 'COMMODITIES', tvSymbol: 'TVC:UKOIL',        icon: '🛢' },
  { symbol: 'XAUUSD', name: 'Gold',               type: 'COMMODITIES', tvSymbol: 'OANDA:XAUUSD',     icon: '🪙' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar',   type: 'FOREX',       tvSymbol: 'OANDA:EURUSD',     icon: '€' },
  { symbol: 'GBPUSD', name: 'British Pound / USD',type: 'FOREX',       tvSymbol: 'OANDA:GBPUSD',     icon: '£' },
  { symbol: 'USDJPY', name: 'US Dollar / Yen',    type: 'FOREX',       tvSymbol: 'OANDA:USDJPY',     icon: '¥' },
];

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  CRYPTO:      { bg: 'rgba(251,191,36,0.14)', color: '#fbbf24' },
  STOCKS:      { bg: 'rgba(148,163,184,0.14)', color: '#94a3b8' },
  COMMODITIES: { bg: 'rgba(234,179,8,0.14)',  color: '#eab308' },
  FOREX:       { bg: 'rgba(20,184,166,0.14)', color: '#14b8a6' },
};

// ── Helpers ───────────────────────────────────────────────────────────
function getPriceSymbol(symbol: string) {
  return symbol.replace(/USD$/, '');
}

function fmtNum(n: number | null | undefined, decimals = 2) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVol(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(2);
}

// ── Main component ────────────────────────────────────────────────────
export default function TradePage() {
  const [searchParams] = useSearchParams();

  // Core state
  const [asset, setAsset] = useState<string>('BTCUSD');
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [stats, setStats] = useState<{ change24h: number; high?: number; low?: number; volume?: number }>({ change24h: 0 });
  const [priceLoading, setPriceLoading] = useState(false);

  // Order form state
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [leverage, setLeverage] = useState(1);
  const [marginType, setMarginType] = useState<'ISOLATED' | 'CROSS'>('ISOLATED');
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);

  // UI state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPrices, setDropdownPrices] = useState<Record<string, PriceData>>({});
  const [isDark, setIsDark] = useState(true);

  // Order book
  const [asks, setAsks] = useState<{ price: number; amount: number }[]>([]);
  const [bids, setBids] = useState<{ price: number; amount: number }[]>([]);
  const [trades, setTrades] = useState<{ price: number; amount: number; side: 'buy' | 'sell'; time: string }[]>([]);

  const activeAsset = useMemo(() => ASSETS.find(a => a.symbol === asset) ?? ASSETS[0], [asset]);
  const baseSymbol = useMemo(() => getPriceSymbol(asset), [asset]);
  const positionSize = useMemo(() => (Number(amount) || 0) * leverage, [amount, leverage]);
  const priceUp = prevPrice !== null && price !== null && price >= prevPrice;

  // ── Theme detection ───────────────────────────────────────────────
  useEffect(() => {
    const getTheme = () => document.documentElement.getAttribute('data-theme') !== 'light';
    setIsDark(getTheme());
    const observer = new MutationObserver(() => setIsDark(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // ── URL params ────────────────────────────────────────────────────
  useEffect(() => {
    const assetParam = searchParams.get('asset');
    if (assetParam) {
      const direct = ASSETS.find(a => a.symbol === assetParam);
      const withUsd = ASSETS.find(a => a.symbol === `${assetParam}USD`);
      const match = direct ?? withUsd;
      if (match) setAsset(match.symbol);
    }
    const actionParam = searchParams.get('action');
    if (actionParam === 'BUY' || actionParam === 'SELL') setSide(actionParam);
  }, [searchParams]);

  // ── Keyboard shortcuts ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'b' || e.key === 'B') setSide('BUY');
      if (e.key === 's' || e.key === 'S') setSide('SELL');
      if (e.key === 'Escape') setSelectorOpen(false);
      if (e.key === '/' && !selectorOpen) { e.preventDefault(); setSelectorOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectorOpen]);

  // ── Fetch dropdown prices (for selector) ──────────────────────────
  useEffect(() => {
    ASSETS.forEach(async (a) => {
      const sym = getPriceSymbol(a.symbol);
      try {
        const res = await fetch(`/api/price?symbol=${sym}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.price) {
          setDropdownPrices(prev => ({
            ...prev,
            [a.symbol]: { price: data.price, change24h: data.change24h ?? 0 },
          }));
        }
      } catch {}
    });
  }, []);

  // ── Fetch balance ─────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/user/dashboard', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user) setBalance(Number(data.user.portfolioBalance) || 0);
      if (data?.positions) {
        // Build positions from dashboard response if available
        // For now, fetch separately
      }
    } catch {}
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/assets', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.positions)) {
        setPositions(data.positions.map((p: any) => ({
          id: p.id,
          asset: p.asset,
          symbol: p.symbol,
          quantity: Number(p.quantity),
          entryPrice: Number(p.entryPrice),
          currentPnl: Number(p.currentPnl),
          side: p.side,
          leverage: Number(p.leverage),
        })));
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchPositions();
  }, [fetchBalance, fetchPositions]);

  // ── Fetch live price + order book ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchPrice = async () => {
      try {
        setPriceLoading(true);
        const res = await fetch(`/api/price?symbol=${baseSymbol}`);
        if (!res.ok) throw new Error('Price API failed');
        const data = await res.json();
        if (cancelled) return;
        if (!data.price) throw new Error('No price');

        const p = Number(data.price);
        setPrice(prev => {
          setPrevPrice(prev);
          return p;
        });
        setStats({
          change24h: data.change24h ?? 0,
          high: p * 1.015 + Math.random() * p * 0.008,
          low: p * 0.985 - Math.random() * p * 0.008,
          volume: 50_000_000 + Math.random() * 400_000_000,
        });

        // Synthetic order book
        const spread = p * 0.0004;
        const makeRows = (count: number, dir: 1 | -1) =>
          Array.from({ length: count }, (_, i) => ({
            price: Number((p + dir * (i + 1) * spread).toFixed(2)),
            amount: Number((Math.random() * 2.5 + 0.05).toFixed(4)),
          }));

        setAsks(makeRows(12, 1).reverse());
        setBids(makeRows(12, -1));

        // Synthetic trades
        setTrades(prev => {
          const newTrades = Array.from({ length: 3 }, () => ({
            price: Number((p + (Math.random() - 0.5) * spread * 2).toFixed(2)),
            amount: Number((Math.random() * 0.8 + 0.01).toFixed(4)),
            side: (Math.random() > 0.5 ? 'buy' : 'sell') as 'buy' | 'sell',
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          }));
          return [...newTrades, ...prev].slice(0, 30);
        });
      } catch (err: any) {
        if (!cancelled) toast.error('Price data unavailable');
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    };

    fetchPrice();
    const id = setInterval(fetchPrice, 5_000); // 5s for snappier updates
    return () => { cancelled = true; clearInterval(id); };
  }, [asset, baseSymbol]);

  // ── Filtered assets for selector ───────────────────────────────────
  const filteredAssets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return ASSETS;
    return ASSETS.filter(a =>
      a.symbol.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // ── Set percentage of balance ─────────────────────────────────────
  const setPercentage = (pct: number) => {
    if (side === 'BUY') {
      setAmount((balance * pct).toFixed(2));
    } else {
      toast.error('Enter sell amount manually');
    }
  };

  // ── Submit trade ──────────────────────────────────────────────────
  const handleTrade = async () => {
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0) return toast.error('Enter a valid amount');
    if (price === null) return toast.error('Price unavailable');
    if (orderType === 'MARKET' && side === 'BUY' && numAmount > balance) {
      return toast.error('Insufficient balance');
    }
    if (orderType !== 'MARKET' && !limitPrice) return toast.error('Enter limit/stop price');

    setSubmitting(true);
    try {
      const res = await fetch('/api/transaction/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: side,
          asset: baseSymbol,
          amount: numAmount,
          price: orderType === 'MARKET' ? price : Number(limitPrice),
          leverage,
          marginType,
          marketType: activeAsset.type,
          orderType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Trade failed');
      }

      toast.success(`${side} ${baseSymbol} filled${leverage > 1 ? ` · ${leverage}×` : ''}`, {
        duration: 5000,
        icon: side === 'BUY' ? '▲' : '▼',
        style: {
          background: side === 'BUY' ? 'var(--green-l, #0f2a1f)' : 'var(--red-l, #2a0f15)',
          color: side === 'BUY' ? 'var(--green)' : 'var(--red)',
          fontWeight: 700,
          fontFamily: 'var(--mono, monospace)',
          fontSize: '12px',
          border: `1px solid ${side === 'BUY' ? 'var(--green)' : 'var(--red)'}`,
        },
      });

      setAmount('');
      fetchBalance();
      fetchPositions();
    } catch (err: any) {
      toast.error(err.message ?? 'Trade failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── TradingView chart ─────────────────────────────────────────────
  const chartSrc = useMemo(() => {
    return `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(activeAsset.tvSymbol)}&interval=15&theme=${isDark ? 'dark' : 'light'}&style=1&locale=en&hide_top_toolbar=0&hide_legend=0&save_image=0`;
  }, [activeAsset.tvSymbol, isDark]);

  // ── Order book totals for depth visualization ─────────────────────
  const askCum = useMemo(() => {
    let total = 0;
    return asks.map(a => (total += a.amount, total));
  }, [asks]);
  const bidCum = useMemo(() => {
    let total = 0;
    return bids.map(b => (total += b.amount, total));
  }, [bids]);
  const maxCum = Math.max(askCum[0] ?? 0, bidCum[0] ?? 0, 1);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-center" />

      <div className="trade">

        {/* ══ TOP MARKET BAR ══ */}
        <div className="topbar">
          <div
            className={`asset-head ${selectorOpen ? 'open' : ''}`}
            onClick={() => setSelectorOpen(v => !v)}
          >
            <span className="asset-sym">{activeAsset.symbol}</span>
            <span
              className="type-badge"
              style={{
                background: TYPE_COLORS[activeAsset.type].bg,
                color: TYPE_COLORS[activeAsset.type].color,
              }}
            >
              {activeAsset.type}
            </span>
            <span className="asset-arrow">▼</span>
          </div>

          <span className={`price-hero ${price === null ? 'flat' : priceUp ? 'up' : 'down'}`}>
            {price !== null ? `$${fmtNum(price, price < 1 ? 4 : 2)}` : '—'}
          </span>

          <span className={`change-chip ${stats.change24h >= 0 ? 'up' : 'down'}`}>
            {stats.change24h >= 0 ? '+' : ''}{fmtNum(stats.change24h)}%
          </span>

          <div className="stat-group">
            <div className="stat-kv">
              <span className="stat-k">24h High</span>
              <span className="stat-v">${fmtNum(stats.high, stats.high && stats.high < 1 ? 4 : 2)}</span>
            </div>
            <div className="stat-kv">
              <span className="stat-k">24h Low</span>
              <span className="stat-v">${fmtNum(stats.low, stats.low && stats.low < 1 ? 4 : 2)}</span>
            </div>
            <div className="stat-kv">
              <span className="stat-k">24h Vol</span>
              <span className="stat-v">{fmtVol(stats.volume)}</span>
            </div>
            <div className="stat-kv">
              <span className="stat-k">Status</span>
              <span className={`stat-v ${priceLoading ? '' : 'up'}`}>
                {priceLoading ? 'SYNC…' : 'LIVE'}
              </span>
            </div>
          </div>
        </div>

        {/* ══ MAIN 3-PANEL GRID ══ */}
        <div className="grid">

          {/* ── LEFT: ORDER BOOK ── */}
          <div className="panel-book">
            <div className="panel-head">
              <span className="panel-title">Order Book</span>
              <div className="panel-tabs">
                <button className="panel-tab on">0.01</button>
                <button className="panel-tab">0.1</button>
                <button className="panel-tab">1</button>
              </div>
            </div>

            <div className="ob-cols">
              <span>Price (USD)</span>
              <span>Amount</span>
              <span>Total</span>
            </div>

            <div className="ob">
              {/* Asks (red, highest first) */}
              <div className="ob-side">
                {asks.map((a, i) => {
                  const total = a.price * a.amount;
                  const cum = askCum[i];
                  return (
                    <div className="ob-row ask" key={i} onClick={() => setLimitPrice(a.price.toString())}>
                      <span>{fmtNum(a.price, 2)}</span>
                      <span>{fmtNum(a.amount, 4)}</span>
                      <span>{fmtNum(total, 2)}</span>
                      <div className="ob-bar" style={{ width: `${(cum / maxCum) * 100}%` }} />
                    </div>
                  );
                })}
              </div>

              {/* Spread */}
              <div className="ob-spread">
                <span>Spread</span>
                <strong>
                  {asks.length && bids.length
                    ? `${fmtNum(asks[asks.length - 1].price - bids[0].price, 2)} (${fmtNum(((asks[asks.length - 1].price - bids[0].price) / asks[asks.length - 1].price) * 100, 3)}%)`
                    : '—'}
                </strong>
              </div>

              {/* Bids (green) */}
              <div className="ob-side">
                {bids.map((b, i) => {
                  const total = b.price * b.amount;
                  const cum = bidCum[i];
                  return (
                    <div className="ob-row bid" key={i} onClick={() => setLimitPrice(b.price.toString())}>
                      <span>{fmtNum(b.price, 2)}</span>
                      <span>{fmtNum(b.amount, 4)}</span>
                      <span>{fmtNum(total, 2)}</span>
                      <div className="ob-bar" style={{ width: `${(cum / maxCum) * 100}%` }} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Market depth mini chart */}
            <div className="ob-depth">
              <div className="ob-depth-title">Market Depth</div>
              <svg className="ob-depth-svg" viewBox="0 0 220 50" preserveAspectRatio="none">
                {/* Asks (right side, red) */}
                <path
                  d={
                    'M 110 50 ' +
                    askCum
                      .slice()
                      .reverse()
                      .map((c, i) => `L ${110 + (i / askCum.length) * 110} ${50 - (c / maxCum) * 48}`)
                      .join(' ') +
                    ` L 220 50 Z`
                  }
                  fill="var(--neg)"
                  fillOpacity="0.25"
                  stroke="var(--neg)"
                  strokeWidth="1"
                />
                {/* Bids (left side, green) */}
                <path
                  d={
                    'M 110 50 ' +
                    bidCum
                      .map((c, i) => `L ${110 - (i / bidCum.length) * 110} ${50 - (c / maxCum) * 48}`)
                      .join(' ') +
                    ` L 0 50 Z`
                  }
                  fill="var(--pos)"
                  fillOpacity="0.25"
                  stroke="var(--pos)"
                  strokeWidth="1"
                />
              </svg>
            </div>
          </div>

          {/* ── CENTER: CHART ── */}
          <div className="panel-chart">
            <iframe
              key={chartSrc}
              src={chartSrc}
              className="chart-frame"
              title={`${activeAsset.symbol} chart`}
              allowTransparency
            />
            {priceLoading && price === null && (
              <div className="chart-loading">LOADING CHART…</div>
            )}
          </div>

          {/* ── CENTER-BOTTOM: TIME & SALES ── */}
          <div className="panel-tape">
            <div className="panel-head">
              <span className="panel-title">Time &amp; Sales</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink3)', letterSpacing: '0.1em' }}>
                {trades.length} TRADES
              </span>
            </div>
            <div className="tape-cols">
              <span>Price</span>
              <span>Amount</span>
              <span>Time</span>
            </div>
            <div className="tape-list">
              {trades.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ink3)', fontSize: '10px' }}>
                  Waiting for trades…
                </div>
              ) : (
                trades.map((t, i) => (
                  <div className={`tape-row ${t.side}`} key={i}>
                    <span>{fmtNum(t.price, 2)}</span>
                    <span>{fmtNum(t.amount, 4)}</span>
                    <span>{t.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT: ORDER ENTRY + POSITIONS ── */}
          <div className="panel-order">
            <div className="panel-head">
              <span className="panel-title">Order Entry</span>
              <button
                className="panel-tab"
                onClick={() => setMarginType(m => m === 'ISOLATED' ? 'CROSS' : 'ISOLATED')}
                style={{ color: 'var(--acc)' }}
              >
                {marginType}
              </button>
            </div>

            <div className="order-body">
              {/* Buy / Sell */}
              <div className="side-toggle">
                <button className={`side-btn buy ${side === 'BUY' ? 'active' : ''}`} onClick={() => setSide('BUY')}>
                  ▲ Buy / Long
                </button>
                <button className={`side-btn sell ${side === 'SELL' ? 'active' : ''}`} onClick={() => setSide('SELL')}>
                  ▼ Sell / Short
                </button>
              </div>

              {/* Order type */}
              <div className="type-tabs">
                {(['MARKET', 'LIMIT', 'STOP'] as const).map(t => (
                  <button
                    key={t}
                    className={`type-tab ${orderType === t ? 'on' : ''}`}
                    onClick={() => setOrderType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Limit price (for LIMIT/STOP) */}
              {orderType !== 'MARKET' && (
                <div className="input-row">
                  <div className="input-label">
                    <span>{orderType === 'LIMIT' ? 'Limit' : 'Stop'} Price</span>
                    <button onClick={() => setLimitPrice(price?.toString() ?? '')}>Last</button>
                  </div>
                  <div className="input-box">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={limitPrice}
                      onChange={e => setLimitPrice(e.target.value)}
                    />
                    <span className="input-unit">USD</span>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="input-row">
                <div className="input-label">
                  <span>{side === 'BUY' ? 'Cost' : 'Size'}</span>
                  <span style={{ color: 'var(--ink3)' }}>
                    ≈ {price ? fmtNum(positionSize / price, 6) : '0'} {baseSymbol}
                  </span>
                </div>
                <div className="input-box">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                  <span className="input-unit">USD</span>
                </div>
              </div>

              {/* Percentage buttons */}
              <div className="pct-grid">
                {[0.25, 0.5, 0.75, 1].map(pct => (
                  <button key={pct} className="pct-btn" onClick={() => setPercentage(pct)}>
                    {pct * 100}%
                  </button>
                ))}
              </div>

              {/* Leverage */}
              <div className="slider-row">
                <div className="slider-head">
                  <span className="input-label" style={{ display: 'inline' }}>
                    <span>Leverage</span>
                  </span>
                  <span className="slider-value">{leverage}×</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={leverage}
                  onChange={e => setLeverage(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--acc)' }}
                />
                <div className="slider-marks">
                  {[1, 5, 10, 25, 50, 100].map(l => (
                    <button
                      key={l}
                      className={`slider-mark ${leverage === l ? 'active' : ''}`}
                      onClick={() => setLeverage(l)}
                    >
                      {l}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Balance */}
              <div className="balance-row">
                <span className="lbl">Available</span>
                <span className="val">${fmtNum(balance)}</span>
              </div>

              {/* Summary */}
              {Number(amount) > 0 && (
                <div className="summary">
                  <div className="summary-line">
                    <span className="k">Order Value</span>
                    <span className="v">${fmtNum(positionSize)}</span>
                  </div>
                  <div className="summary-line">
                    <span className="k">Margin Required</span>
                    <span className="v">${fmtNum(Number(amount))}</span>
                  </div>
                  <div className="summary-line">
                    <span className="k">Fee (est.)</span>
                    <span className="v">${fmtNum(positionSize * 0.001)}</span>
                  </div>
                  <div className="summary-line total">
                    <span className="k">Total Cost</span>
                    <span className="v">${fmtNum(Number(amount) + positionSize * 0.001)}</span>
                  </div>
                </div>
              )}

              {/* Execute */}
              <button
                className={`exec-btn ${side === 'BUY' ? 'buy' : 'sell'}`}
                onClick={handleTrade}
                disabled={submitting || price === null}
              >
                {submitting ? 'EXECUTING…' : `${side === 'BUY' ? 'BUY' : 'SELL'} ${baseSymbol} ${orderType}`}
              </button>

              <div style={{ fontFamily: 'var(--mono)', fontSize: '9px', color: 'var(--ink3)', textAlign: 'center', letterSpacing: '0.08em' }}>
                SHORTCUTS: B=BUY · S=SELL · /=SEARCH
              </div>
            </div>

            {/* ── OPEN POSITIONS ── */}
            <div className="positions">
              <div className="positions-head">
                <span className="panel-title">Open Positions</span>
                <span className="positions-count">{positions.length} ACTIVE</span>
              </div>
              {positions.length === 0 ? (
                <div className="positions-empty">No open positions</div>
              ) : (
                positions.slice(0, 5).map(p => (
                  <div className="position-item" key={p.id}>
                    <span className={`position-side ${p.side.toLowerCase()}`}>
                      {p.side === 'LONG' ? '▲ L' : '▼ S'} {p.leverage}×
                    </span>
                    <div className="position-meta">
                      <span className="position-sym">{p.asset}</span>
                      <span className="position-detail">
                        {fmtNum(p.quantity, 6)} @ ${fmtNum(p.entryPrice, 2)}
                      </span>
                    </div>
                    <div className="position-pnl">
                      <span className={`position-pnl-val ${p.currentPnl >= 0 ? 'pos' : 'neg'}`}>
                        {p.currentPnl >= 0 ? '+' : ''}{fmtNum(p.currentPnl)}
                      </span>
                      <button className="position-close">Close</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ══ ASSET SELECTOR MODAL ══ */}
        {selectorOpen && (
          <div className="selector-overlay" onClick={() => setSelectorOpen(false)}>
            <div className="selector" onClick={e => e.stopPropagation()}>
              <div className="selector-search">
                <input
                  type="text"
                  placeholder="Search markets…"
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && setSelectorOpen(false)}
                />
                <span className="selector-hint">ESC</span>
              </div>
              <div className="selector-list">
                {filteredAssets.length === 0 ? (
                  <div className="selector-empty">No markets match "{searchQuery}"</div>
                ) : (
                  filteredAssets.map(a => {
                    const dp = dropdownPrices[a.symbol];
                    return (
                      <button
                        key={a.symbol}
                        className="selector-item"
                        onClick={() => { setAsset(a.symbol); setSelectorOpen(false); setSearchQuery(''); }}
                      >
                        <div className="selector-icon">
                          {a.logo
                            ? <img src={a.logo} alt={a.symbol} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            : <span>{a.icon ?? a.symbol.slice(0, 2)}</span>
                          }
                        </div>
                        <div className="selector-info">
                          <span className="selector-sym">{a.symbol}</span>
                          <span className="selector-name">{a.name}</span>
                        </div>
                        <span
                          className="type-badge"
                          style={{
                            background: TYPE_COLORS[a.type].bg,
                            color: TYPE_COLORS[a.type].color,
                          }}
                        >
                          {a.type}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span className="selector-price">${dp ? fmtNum(dp.price, dp.price < 1 ? 4 : 2) : '—'}</span>
                          {dp && (
                            <span className={`selector-chg ${dp.change24h >= 0 ? 'up' : 'down'}`}>
                              {dp.change24h >= 0 ? '+' : ''}{fmtNum(dp.change24h)}%
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
