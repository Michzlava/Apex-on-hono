import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUp, ArrowDown, Wallet, Loader2,
  ChevronDown, Search, TrendingUp,
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type PriceData = { price: number; change24h: number };

// ── Static asset list ─────────────────────────────────────────────────────────

const ALL_ASSETS = [
  { symbol: 'BTCUSD', name: 'Bitcoin',             type: 'CRYPTO' },
  { symbol: 'ETHUSD', name: 'Ethereum',            type: 'CRYPTO' },
  { symbol: 'SOLUSD', name: 'Solana',              type: 'CRYPTO' },
  { symbol: 'BNBUSD', name: 'BNB',                 type: 'CRYPTO' },
  { symbol: 'AAPL',   name: 'Apple Inc.',          type: 'STOCKS' },
  { symbol: 'TSLA',   name: 'Tesla, Inc.',         type: 'STOCKS' },
  { symbol: 'NVDA',   name: 'NVIDIA Corp.',        type: 'STOCKS' },
  { symbol: 'MSFT',   name: 'Microsoft Corp.',     type: 'STOCKS' },
  { symbol: 'AMZN',   name: 'Amazon.com Inc.',     type: 'STOCKS' },
  { symbol: 'GOOGL',  name: 'Alphabet Inc.',       type: 'STOCKS' },
  { symbol: 'USOIL',  name: 'WTI Crude Oil',       type: 'COMMODITIES' },
  { symbol: 'UKOIL',  name: 'Brent Crude Oil',     type: 'COMMODITIES' },
  { symbol: 'XAUUSD', name: 'Gold',                type: 'COMMODITIES' },
  { symbol: 'EURUSD', name: 'Euro / US Dollar',    type: 'FOREX' },
  { symbol: 'GBPUSD', name: 'British Pound / USD', type: 'FOREX' },
  { symbol: 'USDJPY', name: 'US Dollar / Yen',     type: 'FOREX' },
];

// ── Asset logos ───────────────────────────────────────────────────────────────

const ASSET_LOGOS: Record<string, string> = {
  BTCUSD: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETHUSD: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOLUSD: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BNBUSD: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  AAPL:   'https://img.logo.dev/apple.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ',
  TSLA:   'https://img.logo.dev/tesla.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ',
  NVDA:   'https://img.logo.dev/nvidia.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ',
  MSFT:   'https://img.logo.dev/microsoft.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ',
  AMZN:   'https://img.logo.dev/amazon.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ',
  GOOGL:  'https://img.logo.dev/google.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ',
};

const ASSET_ICONS: Record<string, string> = {
  USOIL:  '🛢',
  UKOIL:  '🛢',
  XAUUSD: '🪙',
  EURUSD: '🇪🇺',
  GBPUSD: '🇬🇧',
  USDJPY: '🇯🇵',
};

// ── TradingView symbol mapping (exchange:symbol) ──────────────────────────────

const TV_SYMBOL_MAP: Record<string, string> = {
  BTCUSD: 'BINANCE:BTCUSDT',
  ETHUSD: 'BINANCE:ETHUSDT',
  SOLUSD: 'BINANCE:SOLUSDT',
  BNBUSD: 'BINANCE:BNBUSDT',
  AAPL:   'NASDAQ:AAPL',
  TSLA:   'NASDAQ:TSLA',
  NVDA:   'NASDAQ:NVDA',
  MSFT:   'NASDAQ:MSFT',
  AMZN:   'NASDAQ:AMZN',
  GOOGL:  'NASDAQ:GOOGL',
  USOIL:  'TVC:USOIL',
  UKOIL:  'TVC:UKOIL',
  XAUUSD: 'OANDA:XAUUSD',
  EURUSD: 'OANDA:EURUSD',
  GBPUSD: 'OANDA:GBPUSD',
  USDJPY: 'OANDA:USDJPY',
};

// ── Type badge ────────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
  CRYPTO:      { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24' },
  STOCKS:      { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  COMMODITIES: { bg: 'rgba(234,179,8,0.12)',   color: '#eab308' },
  FOREX:       { bg: 'rgba(20,184,166,0.12)',  color: '#14b8a6' },
};

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_BADGE[type] ?? TYPE_BADGE.CRYPTO;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4,
      fontFamily: 'var(--mono)', border: `1px solid ${s.color}22`,
    }}>
      {type}
    </span>
  );
}

// ── Price symbol mapping ──────────────────────────────────────────────────────

const PRICE_SYMBOL_MAP: Record<string, string> = {
  USOIL: 'USOIL', UKOIL: 'UKOIL', XAUUSD: 'XAUUSD',
  EURUSD: 'EURUSD', GBPUSD: 'GBPUSD', USDJPY: 'USDJPY',
  AAPL: 'AAPL', TSLA: 'TSLA', NVDA: 'NVDA',
  MSFT: 'MSFT', AMZN: 'AMZN', GOOGL: 'GOOGL',
};

function getPriceSymbol(symbol: string) {
  return PRICE_SYMBOL_MAP[symbol] ?? symbol.replace('USD', '');
}

// ── Resolve asset param ───────────────────────────────────────────────────────

function resolveAssetParam(assetParam: string | null): string | null {
  if (!assetParam) return null;
  const direct = ALL_ASSETS.find(a => a.symbol === assetParam);
  if (direct) return direct.symbol;
  const withUsd = ALL_ASSETS.find(a => a.symbol === `${assetParam}USD`);
  return withUsd ? withUsd.symbol : null;
}

// ── Trade Page ────────────────────────────────────────────────────────────────

export default function TradePage() {
  const [searchParams] = useSearchParams();

  const [asset, setAsset] = useState(() => resolveAssetParam(searchParams.get('asset')) ?? 'BTCUSD');
  const [price, setPrice]               = useState<number | null>(null);
  const [prevPrice, setPrevPrice]       = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [amount, setAmount]             = useState('');
  const [balance, setBalance]           = useState(0);
  const [loading, setLoading]           = useState(false);
  const [orderType, setOrderType]       = useState<'BUY' | 'SELL'>('BUY');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [leverage, setLeverage]         = useState(1);
  const [marginType, setMarginType]     = useState<'ISOLATED' | 'CROSS'>('ISOLATED');
  const [bids, setBids]                 = useState<{ price: string; amount: string }[]>([]);
  const [asks, setAsks]                 = useState<{ price: string; amount: string }[]>([]);
  const [dropdownPrices, setDropdownPrices] = useState<Record<string, PriceData>>({});
  const [isDark, setIsDark]             = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeAsset  = useMemo(() => ALL_ASSETS.find(a => a.symbol === asset), [asset]);
  const assetType    = useMemo(() => activeAsset?.type ?? 'CRYPTO', [activeAsset]);
  const baseSymbol   = useMemo(() => getPriceSymbol(asset), [asset]);
  const positionSize = useMemo(() => Number(amount) * leverage, [amount, leverage]);
  const priceUp      = prevPrice !== null && price !== null && price >= prevPrice;

  const filteredAssets = useMemo(() =>
    ALL_ASSETS.filter(a =>
      a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()),
    ), [searchQuery]);

  const priceFormatter = useMemo(() =>
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    }), []);

  // ── Theme detection ───────────────────────────────────────────────────────

  useEffect(() => {
    const getTheme = () =>
      document.documentElement.getAttribute('data-theme') !== 'light';
    setIsDark(getTheme());
    const observer = new MutationObserver(() => setIsDark(getTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // ── Sync URL params after mount ───────────────────────────────────────────

  useEffect(() => {
    const resolved = resolveAssetParam(searchParams.get('asset'));
    if (resolved) setAsset(resolved);
    const actionParam = searchParams.get('action');
    if (actionParam === 'BUY' || actionParam === 'SELL') setOrderType(actionParam);
  }, [searchParams]);

  // ── Close dropdown on outside click ──────────────────────────────────────

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch dropdown prices ─────────────────────────────────────────────────

  useEffect(() => {
    ALL_ASSETS.forEach(async (a) => {
      const sym = getPriceSymbol(a.symbol);
      try {
        const res = await fetch(`/api/price?symbol=${sym}`);
        if (!res.ok) throw new Error(`Price fetch failed: ${res.status}`);
        const data = await res.json();
        if (data.price) setDropdownPrices(prev => ({
          ...prev,
          [a.symbol]: { price: data.price, change24h: data.change24h ?? 0 },
        }));
      } catch (err) {
        console.error(`[price] ${a.symbol}:`, err);
      }
    });
  }, []);

  // ── Fetch balance ─────────────────────────────────────────────────────────

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/user/dashboard', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.user) setBalance(Number(data.user.portfolioBalance) || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // ── Fetch live price ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const fetchPrice = async () => {
      try {
        setPriceLoading(true);
        const res = await fetch(`/api/price?symbol=${baseSymbol}`);
        if (!res.ok) throw new Error(`Price API returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.price) throw new Error('No price in response');

        const p = Number(data.price);
        setPrice(prev => { setPrevPrice(prev); return p; });

        const spread = p * 0.0005;
        setAsks(
          Array.from({ length: 5 }, (_, i) => ({
            price:  (p + (i + 1) * spread).toFixed(2),
            amount: (Math.random() * 1.5 + 0.1).toFixed(4),
          })).reverse(),
        );
        setBids(
          Array.from({ length: 5 }, (_, i) => ({
            price:  (p - (i + 1) * spread).toFixed(2),
            amount: (Math.random() * 1.5 + 0.1).toFixed(4),
          })),
        );
      } catch (err: any) {
        console.error('[live price]', err);
        if (!cancelled) toast.error('Price data unavailable');
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    };

    fetchPrice();
    const id = setInterval(fetchPrice, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [asset, baseSymbol]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const setPercentage = (pct: number) => {
    if (orderType === 'BUY') setAmount((balance * pct).toFixed(2));
    else toast.error('Enter sell amount manually based on your holdings');
  };

  // ── Submit trade ──────────────────────────────────────────────────────────

  const handleTrade = async () => {
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0)                  return toast.error('Enter a valid amount');
    if (price === null)                             return toast.error('Price unavailable');
    if (orderType === 'BUY' && numAmount > balance) return toast.error('Insufficient balance');

    setLoading(true);
    try {
      const res = await fetch('/api/transaction/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: orderType, asset: baseSymbol,
          amount: numAmount, price, leverage, marginType,
          marketType: assetType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? 'Trade failed');
      }

      toast.success(`${orderType} order filled — ${baseSymbol}${leverage > 1 ? ` ${leverage}×` : ''}`, {
        duration: 5000,
        icon: orderType === 'BUY' ? '↑' : '↓',
        style: {
          background: orderType === 'BUY' ? 'var(--green-l)' : 'var(--red-l)',
          color:      orderType === 'BUY' ? 'var(--green)'   : 'var(--red)',
          fontWeight: 700, fontFamily: 'monospace', fontSize: '13px',
          border: `1px solid color-mix(in srgb, ${orderType === 'BUY' ? 'var(--green)' : 'var(--red)'} 25%, transparent)`,
        },
      });

      setAmount('');
      fetchBalance();
    } catch (err: any) {
      toast.error(err.message ?? 'Trade failed');
    } finally {
      setLoading(false);
    }
  };

  // ── TradingView chart src ─────────────────────────────────────────────────

  const chartSrc = useMemo(() => {
    const tvSymbol = TV_SYMBOL_MAP[asset] ?? asset;
    return `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=15&theme=${isDark ? 'dark' : 'light'}&style=1&locale=en&hide_top_toolbar=0&hide_legend=0&save_image=0`;
  }, [asset, isDark]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .trade-wrap {
          min-height: calc(100vh - 44px);
          background: var(--bg);
          display: flex; flex-direction: column;
          gap: 10px; padding: 12px;
          color: var(--ink);
          font-family: var(--sans);
        }
        @media (min-width: 1024px) {
          .trade-wrap { flex-direction: row; height: calc(100vh - 44px); overflow: hidden; }
        }

        .card {
          background: var(--card);
          border: 1px solid var(--line-strong);
          border-radius: 14px;
        }

        .trade-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; flex-wrap: wrap; gap: 12px;
        }
        .asset-selector { position: relative; }
        .asset-btn {
          background: none; border: none; cursor: pointer;
          display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
          padding: 6px 10px; border-radius: 8px; transition: background 0.15s;
        }
        .asset-btn:hover { background: var(--surface-hover); }
        .asset-name {
          font-family: var(--mono); font-size: 1.4rem; font-weight: 600;
          color: var(--ink); display: flex; align-items: center; gap: 6px;
          letter-spacing: -0.02em;
        }
        .chevron-wrap {
          display: flex; align-items: center;
          color: var(--ink-faint); transition: transform 0.2s;
        }
        .chevron-wrap.open { transform: rotate(180deg); }

        .asset-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0;
          width: 440px;
          background: var(--card);
          border: 1px solid var(--line-strong); border-radius: 14px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          overflow: hidden; z-index: 50;
          animation: dropIn 0.15s ease;
        }
        @media (max-width: 480px) {
          .asset-dropdown { width: calc(100vw - 24px); }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dropdown-search {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 18px; border-bottom: 1px solid var(--line-strong);
          background: var(--bg);
        }
        .dropdown-search input {
          background: none; border: none; outline: none;
          font-family: var(--mono); font-size: 0.85rem;
          color: var(--ink-2); width: 100%;
        }
        .dropdown-search input::placeholder { color: var(--ink-faint); }
        .dropdown-list { max-height: 560px; overflow-y: auto; }
        .dropdown-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px 18px; border: none; background: none; width: 100%;
          cursor: pointer; border-bottom: 1px solid var(--line);
          transition: background 0.1s; text-align: left; gap: 12px;
        }
        .dropdown-item:hover { background: var(--surface-hover); }
        .dropdown-item-left { display: flex; align-items: center; gap: 14px; }
        .dropdown-icon {
          width: 48px; height: 48px; border-radius: 50%;
          background: var(--surface); display: flex; align-items: center;
          justify-content: center; font-family: var(--mono); font-size: 0.8rem;
          color: var(--ink-faint); flex-shrink: 0; font-weight: 700;
          overflow: hidden;
        }
        .dropdown-icon img { width: 100%; height: 100%; object-fit: cover; }
        .dropdown-item-sym {
          font-family: var(--mono); font-size: 0.92rem; font-weight: 600;
          color: var(--ink); margin-bottom: 3px;
        }
        .dropdown-item-name { font-size: 0.74rem; color: var(--ink-faint); }
        .dropdown-item-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .dropdown-item-price { font-family: var(--mono); font-size: 0.8rem; color: var(--ink-2); }
        .dropdown-item-chg   { font-family: var(--mono); font-size: 0.68rem; font-weight: 700; }

        .price-display {
          font-family: var(--mono); font-size: 1.8rem; font-weight: 600;
          letter-spacing: -0.03em; transition: color 0.4s;
        }
        .price-display.up   { color: var(--green); }
        .price-display.down { color: var(--red); }
        .price-display.flat { color: var(--ink); }

        .left-col  { flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
        .right-col { width: 100%; display: flex; flex-direction: column; gap: 10px; padding-bottom: 20px; }
        @media (min-width: 1024px) {
          .right-col { width: 320px; overflow-y: auto; padding-bottom: 0; }
        }

        .chart-wrap {
          flex: 1; position: relative; overflow: hidden;
          border-radius: 14px; min-height: 380px;
        }
        @media (min-width: 1024px) { .chart-wrap { min-height: unset; } }
        .chart-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }

        .order-panel { padding: 16px; }
        .order-toggle {
          display: flex; background: var(--bg); border: 1px solid var(--line-strong);
          border-radius: 8px; padding: 3px; margin-bottom: 16px;
        }
        .order-btn {
          flex: 1; padding: 8px; border: none; border-radius: 6px;
          font-family: var(--mono); font-size: 0.65rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
          transition: all 0.15s;
        }
        .order-btn.buy.active   { background: var(--green-l); color: var(--green); }
        .order-btn.sell.active  { background: var(--red-l);   color: var(--red); }
        .order-btn.inactive     { background: none; color: var(--ink-faint); }
        .order-btn.inactive:hover { color: var(--ink-dim); }

        .lev-row { margin-bottom: 14px; }
        .lev-label {
          display: flex; justify-content: space-between; font-size: 0.58rem;
          font-weight: 700; color: var(--ink-faint); text-transform: uppercase;
          letter-spacing: 0.08em; margin-bottom: 8px;
        }
        .margin-toggle-btn {
          background: none; border: none; cursor: pointer;
          font-family: var(--mono); font-size: 0.58rem; font-weight: 700;
          color: var(--accent); letter-spacing: 0.08em; text-transform: uppercase;
        }
        .lev-inputs { display: flex; gap: 6px; align-items: center; }
        .lev-field {
          flex: 1; background: var(--bg); border: 1px solid var(--line-strong);
          border-radius: 6px; padding: 8px 10px;
          display: flex; align-items: center; gap: 4px;
        }
        .lev-field input {
          background: none; border: none; outline: none;
          font-family: var(--mono); font-size: 0.8rem; color: var(--ink); width: 100%;
        }
        .lev-field span { font-family: var(--mono); font-size: 0.7rem; color: var(--ink-faint); }
        .lev-presets { display: flex; gap: 4px; }
        .lev-preset {
          padding: 6px 8px; border-radius: 6px; border: 1px solid var(--line-strong);
          background: none; font-family: var(--mono); font-size: 0.62rem;
          color: var(--ink-faint); cursor: pointer; transition: all 0.12s;
        }
        .lev-preset:hover { color: var(--ink-dim); border-color: var(--line-strong); }
        .lev-preset.active {
          background: var(--surface);
          color: var(--accent);
          border-color: color-mix(in srgb, var(--accent) 30%, transparent);
        }

        .balance-row {
          display: flex; justify-content: space-between; align-items: center;
          font-family: var(--mono); font-size: 0.65rem;
          color: var(--ink-faint); margin-bottom: 10px;
        }

        .amount-field {
          background: var(--bg); border: 1px solid var(--line-strong); border-radius: 8px;
          padding: 10px 14px; display: flex; align-items: center;
          justify-content: space-between; margin-bottom: 10px;
          transition: border-color 0.15s;
        }
        .amount-field:focus-within { border-color: var(--accent); }
        .amount-field label { font-family: var(--mono); font-size: 0.58rem; color: var(--ink-faint); }
        .amount-field input {
          background: none; border: none; outline: none; text-align: right;
          font-family: var(--mono); font-size: 0.9rem; color: var(--ink); width: 120px;
        }
        .amount-field .unit { font-family: var(--mono); font-size: 0.62rem; color: var(--ink-faint); margin-left: 4px; }

        .pct-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px; }
        .pct-btn {
          background: var(--bg); border: 1px solid var(--line-strong); border-radius: 6px;
          padding: 7px; font-family: var(--mono); font-size: 0.62rem;
          color: var(--ink-faint); cursor: pointer; transition: all 0.12s;
        }
        .pct-btn:hover { background: var(--surface-hover); color: var(--ink-dim); }

        .summary-box {
          background: var(--bg); border: 1px solid var(--line-strong); border-radius: 8px;
          padding: 10px 14px; margin-bottom: 14px;
        }
        .summary-row {
          display: flex; justify-content: space-between;
          font-family: var(--mono); font-size: 0.65rem; color: var(--ink-faint); margin-bottom: 6px;
        }
        .summary-row:last-child { margin-bottom: 0; }
        .summary-row span.val { color: var(--ink-2); }

        .exec-btn {
          width: 100%; padding: 13px; border: none; border-radius: 10px;
          font-family: var(--mono); font-size: 0.75rem; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
          transition: all 0.15s; display: flex; align-items: center; justify-content: center;
        }
        .exec-btn.buy {
          background: var(--green); color: var(--green-l);
          box-shadow: 0 4px 20px color-mix(in srgb, var(--green) 20%, transparent);
        }
        .exec-btn.sell {
          background: var(--red); color: var(--red-l);
          box-shadow: 0 4px 20px color-mix(in srgb, var(--red) 20%, transparent);
        }
        .exec-btn:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
        .exec-btn:active:not(:disabled) { transform: scale(0.98); }
        .exec-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .orderbook { padding: 14px 16px; flex: 1; display: flex; flex-direction: column; }
        .ob-header {
          display: flex; justify-content: space-between;
          font-family: var(--mono); font-size: 0.55rem; font-weight: 700;
          color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.1em;
          margin-bottom: 10px;
        }
        .ob-side { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .ob-asks { justify-content: flex-end; margin-bottom: 6px; }
        .ob-bids { margin-top: 6px; }
        .ob-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 3px 6px; border-radius: 3px; position: relative; overflow: hidden;
        }
        .ob-price { font-family: var(--mono); font-size: 0.68rem; font-weight: 500; z-index: 1; }
        .ob-price.ask { color: var(--red); }
        .ob-price.bid { color: var(--green); }
        .ob-qty  { font-family: var(--mono); font-size: 0.62rem; color: var(--ink-faint); z-index: 1; }
        .ob-fill { position: absolute; top: 0; right: 0; height: 100%; border-radius: 3px; opacity: 0.1; }
        .ob-fill.ask { background: var(--red); }
        .ob-fill.bid { background: var(--green); }
        [data-theme="dark"] .ob-fill { opacity: 0.15; }
        .ob-mid {
          display: flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 0;
          border-top: 1px solid var(--line-strong); border-bottom: 1px solid var(--line-strong);
          font-family: var(--mono); font-size: 0.8rem; font-weight: 600;
        }

        .dropdown-list::-webkit-scrollbar,
        .right-col::-webkit-scrollbar { width: 4px; }
        .dropdown-list::-webkit-scrollbar-track,
        .right-col::-webkit-scrollbar-track { background: transparent; }
        .dropdown-list::-webkit-scrollbar-thumb,
        .right-col::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 2px; }

        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>

      <Toaster position="top-center" />

      <div className="trade-wrap">

        {/* ── LEFT COLUMN ── */}
        <div className="left-col">
          <div className="card trade-header">
            <div className="asset-selector" ref={dropdownRef}>
              <button className="asset-btn" onClick={() => setDropdownOpen(v => !v)}>
                <span className="asset-name">
                  {asset}
                  <span className={`chevron-wrap ${dropdownOpen ? 'open' : ''}`}>
                    <ChevronDown size={16} />
                  </span>
                </span>
                <TypeBadge type={assetType} />
              </button>

              {dropdownOpen && (
                <div className="asset-dropdown">
                  <div className="dropdown-search">
                    <Search size={14} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                    <input
                      placeholder="Search assets…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="dropdown-list">
                    {filteredAssets.map(a => {
                      const dp = dropdownPrices[a.symbol];
                      const chgColor = dp && dp.change24h >= 0 ? 'var(--green)' : 'var(--red)';
                      const logo = ASSET_LOGOS[a.symbol];
                      return (
                        <button
                          key={a.symbol}
                          className="dropdown-item"
                          onClick={() => {
                            setAsset(a.symbol);
                            setDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="dropdown-item-left">
                            <div className="dropdown-icon">
                              {logo
                                ? <img src={logo} alt={a.symbol}
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                : <span style={{ fontSize: '1.2rem' }}>{ASSET_ICONS[a.symbol] ?? a.symbol[0]}</span>
                              }
                            </div>
                            <div>
                              <div className="dropdown-item-sym">{a.symbol}</div>
                              <div className="dropdown-item-name">{a.name}</div>
                            </div>
                          </div>
                          <div className="dropdown-item-right">
                            <TypeBadge type={a.type} />
                            {dp ? (
                              <>
                                <span className="dropdown-item-price">
                                  ${dp.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="dropdown-item-chg" style={{ color: chgColor }}>
                                  {dp.change24h >= 0 ? '+' : ''}{dp.change24h.toFixed(2)}%
                                </span>
                              </>
                            ) : (
                              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--ink-faint)' }}>—</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {priceLoading && (
                <Loader2 size={14} style={{ color: 'var(--ink-faint)', animation: 'spin 1s linear infinite' }} />
              )}
              <span className={`price-display ${price === null ? 'flat' : priceUp ? 'up' : 'down'}`}>
                {price !== null ? priceFormatter.format(price) : '—'}
              </span>
              {price !== null && (
                priceUp
                  ? <ArrowUp   size={16} style={{ color: 'var(--green)' }} />
                  : <ArrowDown size={16} style={{ color: 'var(--red)'   }} />
              )}
            </div>
          </div>

          <div className="card chart-wrap" style={{ flex: 1 }}>
            <iframe key={chartSrc} src={chartSrc} allowTransparency />
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="right-col">
          <div className="card order-panel">
            <div className="order-toggle">
              <button
                className={`order-btn buy ${orderType === 'BUY' ? 'active' : 'inactive'}`}
                onClick={() => setOrderType('BUY')}
              >↑ Buy</button>
              <button
                className={`order-btn sell ${orderType === 'SELL' ? 'active' : 'inactive'}`}
                onClick={() => setOrderType('SELL')}
              >↓ Sell</button>
            </div>

            <div className="lev-row">
              <div className="lev-label">
                <span>Leverage &amp; Margin</span>
                <button
                  className="margin-toggle-btn"
                  onClick={() => setMarginType(m => m === 'ISOLATED' ? 'CROSS' : 'ISOLATED')}
                >
                  {marginType}
                </button>
              </div>
              <div className="lev-inputs">
                <div className="lev-field">
                  <input
                    type="number" min={1} max={100} value={leverage}
                    onChange={e => setLeverage(Math.min(100, Math.max(1, Number(e.target.value))))}
                  />
                  <span>×</span>
                </div>
                <div className="lev-presets">
                  {[2, 10, 25, 50].map(l => (
                    <button
                      key={l}
                      className={`lev-preset ${leverage === l ? 'active' : ''}`}
                      onClick={() => setLeverage(l)}
                    >
                      {l}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="balance-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Wallet size={11} /> Balance
              </span>
              <span style={{ color: 'var(--ink-2)' }}>
                ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="amount-field">
              <label>Margin</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="number" placeholder="0.00"
                  value={amount} onChange={e => setAmount(e.target.value)}
                />
                <span className="unit">USD</span>
              </div>
            </div>

            <div className="pct-grid">
              {[0.25, 0.5, 0.75, 1].map(pct => (
                <button key={pct} className="pct-btn" onClick={() => setPercentage(pct)}>
                  {pct * 100}%
                </button>
              ))}
            </div>

            {amount && Number(amount) > 0 && (
              <div className="summary-box">
                <div className="summary-row">
                  <span>Position Size</span>
                  <span className="val">
                    ${positionSize.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="summary-row">
                  <span>Required Margin</span>
                  <span className="val">
                    ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {price !== null && (
                  <div className="summary-row">
                    <span>Est. Units</span>
                    <span className="val">
                      {(positionSize / price).toFixed(6)} {baseSymbol}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              className={`exec-btn ${orderType === 'BUY' ? 'buy' : 'sell'}`}
              onClick={handleTrade}
              disabled={loading || price === null}
            >
              {loading
                ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                : `${orderType} ${baseSymbol}${leverage > 1 ? ` ${leverage}×` : ''}`
              }
            </button>
          </div>

          <div className="card orderbook">
            <div className="ob-header">
              <span>Price (USD)</span>
              <span>Qty ({baseSymbol})</span>
            </div>

            <div className="ob-side ob-asks">
              {asks.map((row, i) => (
                <div key={i} className="ob-row">
                  <span className="ob-price ask">{row.price}</span>
                  <span className="ob-qty">{row.amount}</span>
                  <div className="ob-fill ask" style={{ width: `${20 + Math.random() * 60}%` }} />
                </div>
              ))}
            </div>

            <div className="ob-mid">
              <span style={{ color: priceUp ? 'var(--green)' : 'var(--red)', fontSize: '0.85rem' }}>
                {price !== null ? price.toFixed(2) : '—'}
              </span>
              {priceUp
                ? <TrendingUp size={12} style={{ color: 'var(--green)' }} />
                : <ArrowDown  size={12} style={{ color: 'var(--red)'   }} />
              }
            </div>

            <div className="ob-side ob-bids">
              {bids.map((row, i) => (
                <div key={i} className="ob-row">
                  <span className="ob-price bid">{row.price}</span>
                  <span className="ob-qty">{row.amount}</span>
                  <div className="ob-fill bid" style={{ width: `${20 + Math.random() * 60}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
