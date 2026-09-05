import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './markets-page.css';

type Asset = {
  symbol: string;
  name: string;
  logoUrl: string;
  price: number;
  changePercent: number;
};

type Tab = 'ALL' | 'CRYPTO' | 'STOCKS';
type SortKey = 'price' | 'changePercent';

const CRYPTO_SYMS = ['BTC', 'ETH', 'SOL', 'BNB'];
const STOCK_SYMS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL'];

function fmt(n: number | null | undefined, d = 2) {
  return (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function symSeed(sym: string) {
  let a = 0;
  for (const c of sym) a += c.charCodeAt(0);
  return a;
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
    <svg className={`mk-spark ${positive ? 'up' : 'dn'}`} width="64" height="30" viewBox="0 0 64 30" fill="none">
      <polyline points={points} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function MarketsPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('ALL');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [flash, setFlash] = useState<Record<string, 'up' | 'dn'>>({});
  const prevPrices = useRef<Record<string, number>>({});

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length) {
          setAssets(list);
          setLive(true);
          setLastUpdated(new Date());
        }
      } else setLive(false);
    } catch { setLive(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAssets();
    const id = setInterval(fetchAssets, 30_000);
    return () => clearInterval(id);
  }, [fetchAssets]);

  /* price flash on refresh */
  useEffect(() => {
    const next: Record<string, 'up' | 'dn'> = {};
    for (const m of assets) {
      const prev = prevPrices.current[m.symbol];
      if (prev !== undefined && prev !== m.price) next[m.symbol] = m.price > prev ? 'up' : 'dn';
      prevPrices.current[m.symbol] = m.price;
    }
    if (Object.keys(next).length) {
      setFlash(next);
      const t = setTimeout(() => setFlash({}), 900);
      return () => clearTimeout(t);
    }
  }, [assets]);

  const filtered = useMemo(() => {
    let list = [...assets];
    if (tab === 'CRYPTO') list = list.filter(a => CRYPTO_SYMS.includes(a.symbol));
    if (tab === 'STOCKS') list = list.filter(a => STOCK_SYMS.includes(a.symbol));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
    }
    if (sortKey) list.sort((a, b) => (sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return list;
  }, [assets, tab, search, sortKey, sortDir]);

  const gainers = useMemo(() => [...assets].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3), [assets]);
  const losers  = useMemo(() => [...assets].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3), [assets]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleTrade = (a: Asset, action: 'BUY' | 'SELL') => {
    const tradeSymbol = CRYPTO_SYMS.includes(a.symbol) ? `${a.symbol}USD` : a.symbol;
    navigate(`/dashboard/trade?asset=${tradeSymbol}&action=${action}`);
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === 'desc' ? '↓' : '↑') : '↕');

  return (
    <div className="mk-wrap">
      <div className="mk-inner">

        {/* ══ header ═ */}
        <div className="mk-head">
          <div>
            <p className="mk-eyebrow"><span className="mk-eyebrow-pip" />Apex · Mkts — Market Data</p>
            <h1 className="mk-title">Markets</h1>
          </div>
          <div className="mk-head-right">
            <span className={`mk-live ${live ? 'on' : 'off'}`}>
              <span className="dot" />{live ? 'LIVE FEED' : 'SYNCING'}
            </span>
            {lastUpdated && (
              <span className="mk-updated">
                UPD {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* ══ session leaders ══ */}
        {assets.length > 0 && (
          <div className="mk-movers">
            <div className="mk-card">
              <p className="mk-mover-title up"><span className="mk-pip up" />Top Gainers</p>
              {gainers.map(a => (
                <div className="mk-mover-row" key={a.symbol}>
                  <span className="mk-mover-sym">{a.symbol}</span>
                  <span className="mk-mover-price">${fmt(a.price)}</span>
                  <span className="mk-mover-chg up">+{fmt(a.changePercent)}%</span>
                </div>
              ))}
            </div>
            <div className="mk-card">
              <p className="mk-mover-title dn"><span className="mk-pip dn" />Top Losers</p>
              {losers.map(a => (
                <div className="mk-mover-row" key={a.symbol}>
                  <span className="mk-mover-sym">{a.symbol}</span>
                  <span className="mk-mover-price">${fmt(a.price)}</span>
                  <span className="mk-mover-chg dn">{fmt(a.changePercent)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ controls ═ */}
        <div className="mk-controls">
          <div className="mk-search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input placeholder="Search assets…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="mk-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <div className="mk-tabs">
            {(['ALL', 'CRYPTO', 'STOCKS'] as const).map(t => (
              <button key={t} className={`mk-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ══ table ═ */}
        <div className="mk-card mk-table-card">
          <div className="mk-thead">
            <span className="mk-th mk-c-rank">#</span>
            <span className="mk-th">Asset</span>
            <button className={`mk-th mk-sort ${sortKey === 'price' ? 'sorted' : ''}`} onClick={() => handleSort('price')}>
              Price <span className="mk-arrow">{sortArrow('price')}</span>
            </button>
            <button className={`mk-th mk-sort ${sortKey === 'changePercent' ? 'sorted' : ''}`} onClick={() => handleSort('changePercent')}>
              24h <span className="mk-arrow">{sortArrow('changePercent')}</span>
            </button>
            <span className="mk-th mk-c-trend">Trend</span>
            <span className="mk-th mk-th-right">Trade</span>
          </div>

          {loading ? (
            <div className="mk-empty">
              <div className="mk-spinner" />
              <p>Loading markets…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mk-empty">
              <p>No assets found{search ? ` for “${search}”` : ''}.</p>
            </div>
          ) : (
            filtered.map((a, i) => {
              const up = a.changePercent >= 0;
              return (
                <div className="mk-row" key={a.symbol}>
                  <span className="mk-rank mk-c-rank">{String(i + 1).padStart(2, '0')}</span>
                  <div className="mk-asset">
                    <div className="mk-logo">
                      {a.logoUrl && (
                        <img src={a.logoUrl} alt={a.symbol}
                          onError={e => e.currentTarget.parentElement?.classList.add('broken')} />
                      )}
                      <span className="mk-logo-fb">{a.symbol.slice(0, 2)}</span>
                    </div>
                    <div className="mk-meta">
                      <p className="mk-sym">{a.symbol}</p>
                      <p className="mk-name">{a.name}</p>
                    </div>
                  </div>
                  <span className={`mk-price ${flash[a.symbol] === 'up' ? 'flash-up' : flash[a.symbol] === 'dn' ? 'flash-dn' : ''}`}>
                    ${fmt(a.price)}
                  </span>
                  <span className={`mk-chg ${up ? 'up' : 'dn'}`}>
                    {up ? '+' : ''}{fmt(a.changePercent)}%
                  </span>
                  <span className="mk-c-trend"><MiniSpark positive={up} seed={symSeed(a.symbol)} /></span>
                  <div className="mk-btns">
                    <button className="mk-buy" onClick={() => handleTrade(a, 'BUY')}>Buy</button>
                    <button className="mk-sell" onClick={() => handleTrade(a, 'SELL')}>Sell</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
