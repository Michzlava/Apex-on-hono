import { Hono } from 'hono';

type MarketItem = {
  symbol: string;
  name: string;
  logoUrl: string;
  price: number;
  changePercent: number;
};

const market = new Hono();

/* ── tiny in-memory TTL cache (replaces Next.js `revalidate: 30`) ── */
const TTL = 30_000;
const cache = new Map<string, { at: number; data: any }>();
const getCached = <T,>(key: string): T | null => {
  const e = cache.get(key);
  return e && Date.now() - e.at < TTL ? (e.data as T) : null;
};
const getStale = <T,>(key: string): T | null => (cache.get(key)?.data as T) ?? null;
const setCached = (key: string, data: any) => cache.set(key, { at: Date.now(), data });

/* ── config (same sources as your Next.js app) ── */
const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? ''; // Workers: use c.env instead

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  USOIL: 'CL=F', UKOIL: 'BZ=F', XAUUSD: 'GC=F',
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'JPY=X',
  AAPL: 'AAPL', TSLA: 'TSLA', NVDA: 'NVDA', MSFT: 'MSFT', AMZN: 'AMZN', GOOGL: 'GOOGL',
};
const CRYPTO_GECKO_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
};
const STOCK_META: Record<string, { name: string; logoUrl: string }> = {
  AAPL:  { name: 'Apple Inc.',    logoUrl: 'https://img.logo.dev/apple.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  TSLA:  { name: 'Tesla Inc.',    logoUrl: 'https://img.logo.dev/tesla.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  NVDA:  { name: 'NVIDIA Corp.',  logoUrl: 'https://img.logo.dev/nvidia.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  MSFT:  { name: 'Microsoft',     logoUrl: 'https://img.logo.dev/microsoft.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  AMZN:  { name: 'Amazon',        logoUrl: 'https://img.logo.dev/amazon.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
  GOOGL: { name: 'Alphabet Inc.', logoUrl: 'https://img.logo.dev/google.com?token=pk_NdDz5eDOQFSlkWRQEkcXfQ' },
};

/* ── upstream fetchers ── */
async function fetchCrypto(): Promise<MarketItem[]> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,binancecoin&order=market_cap_desc&sparkline=false&price_change_percentage=24h'
    );
    if (!res.ok) return [];
    const data = await res.json();
    const idMap: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB' };
    return data.map((coin: any) => ({
      symbol: idMap[coin.id] ?? String(coin.symbol).toUpperCase(),
      name: coin.name,
      logoUrl: coin.image,
      price: coin.current_price ?? 0,
      changePercent: coin.price_change_percentage_24h ?? 0,
    }));
  } catch { return []; }
}

async function fetchStocks(): Promise<MarketItem[]> {
  if (!FINNHUB_KEY) return [];
  try {
    const results = await Promise.all(
      Object.keys(STOCK_META).map(async (sym) => {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
        const data = await res.json();
        return {
          symbol: sym,
          name: STOCK_META[sym]?.name ?? sym,
          logoUrl: STOCK_META[sym]?.logoUrl ?? '',
          price: data.c ?? 0,
          changePercent: data.dp ?? 0,
        };
      })
    );
    return results.filter(s => s.price > 0);
  } catch { return []; }
}

/* ── GET /api/market — live list (crypto + stocks), 30s server cache ── */
market.get('/', async (c) => {
  const fresh = getCached<MarketItem[]>('list');
  if (fresh) {
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(fresh);
  }
  const [crypto, stocks] = await Promise.all([fetchCrypto(), fetchStocks()]);
  const all = [...crypto, ...stocks];
  if (all.length) setCached('list', all);
  c.header('Cache-Control', 'public, max-age=30');
  return c.json(all.length ? all : (getStale<MarketItem[]>('list') ?? []));
});

/* ── GET /api/market/price?symbol=X — Yahoo → CoinGecko → Binance ── */
market.get('/price', async (c) => {
  const symbol = (c.req.query('symbol') ?? '').toUpperCase();
  if (!symbol) return c.json({ error: 'Missing symbol' }, 400);

  const cached = getCached<{ symbol: string; price: number; change24h: number }>(`price:${symbol}`);
  if (cached) return c.json({ ...cached, source: 'cache' });

  try {
    let price = 0;
    let change24h = 0;

    if (YAHOO_SYMBOL_MAP[symbol]) {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${YAHOO_SYMBOL_MAP[symbol]}`);
      if (!res.ok) throw new Error('Yahoo fetch failed');
      const data = await res.json();
      const meta = data.chart.result[0].meta;
      price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      change24h = ((price - prevClose) / prevClose) * 100;
    } else {
      const geckoId = CRYPTO_GECKO_MAP[symbol];
      if (!geckoId) return c.json({ error: `Symbol ${symbol} not found` }, 404);

      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`
        );
        if (res.ok) {
          const data = await res.json();
          price = data[geckoId]?.usd;
          change24h = data[geckoId]?.usd_24h_change ?? 0;
        }
      } catch {}

      if (!price) {
        try {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
          if (res.ok) {
            const data = await res.json();
            price = parseFloat(data.lastPrice);
            change24h = parseFloat(data.priceChangePercent);
          }
        } catch {}
      }
    }

    if (!Number.isFinite(price) || price === 0) throw new Error('Invalid price');
    setCached(`price:${symbol}`, { symbol, price, change24h });
    return c.json({ symbol, price, change24h, source: 'api' });
  } catch {
    return c.json({ error: 'Price unavailable' }, 502);
  }
});

export default market;
