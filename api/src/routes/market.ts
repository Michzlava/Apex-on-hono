import { Hono } from 'hono';
import { marketPrices } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const app = new Hono();

type MarketItem = {
  symbol: string;
  name: string;
  logoUrl: string;
  price: number;
  changePercent: number;
};

/* ── 30s in-memory cache ── */
const TTL = 30_000;
let listCache: { at: number; data: MarketItem[] } | null = null;

const FALLBACK_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin',  geckoId: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', geckoId: 'ethereum' },
  { symbol: 'SOL', name: 'Solana',   geckoId: 'solana' },
  { symbol: 'BNB', name: 'BNB',      geckoId: 'binancecoin' },
];

const GECKO_LOGOS: Record<string, string> = {
  bitcoin: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ethereum: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  solana: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  binancecoin: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
};

/* ── provider 1: Binance (bulk, no key) ── */
async function binancePrices(symbols: string[]) {
  const out = new Map<string, { price: number; chg: number }>();
  try {
    const pairs = symbols.map(s => `${s}USDT`);
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`);
    if (res.ok) {
      for (const t of await res.json()) {
        const p = parseFloat(t.lastPrice), d = parseFloat(t.priceChangePercent);
        if (Number.isFinite(p) && p > 0) {
          out.set(String(t.symbol).replace('USDT', ''), { price: p, chg: Number.isFinite(d) ? d : 0 });
        }
      }
    }
  } catch {}
  return out;
}

/* ── provider 2: CoinGecko (bulk, optional demo key via c.env) ── */
async function geckoPrices(geckoIds: string[], key?: string) {
  const out = new Map<string, { price: number; chg: number }>();
  try {
    const headers: Record<string, string> = {};
    if (key) headers['x-cg-demo-api-key'] = key;
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds.join(',')}&vs_currencies=usd&include_24hr_change=true`,
      { headers }
    );
    if (res.ok) {
      const data = await res.json();
      for (const id of geckoIds) {
        const p = data[id]?.usd;
        if (Number.isFinite(p) && p > 0) out.set(id, { price: p, chg: data[id]?.usd_24h_change ?? 0 });
      }
    }
  } catch {}
  return out;
}

/* ── provider 3: Yahoo (per-symbol, no key, works from anywhere) ── */
async function yahooPrice(yahooSym: string) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=1d`);
    if (!res.ok) return null;
    const meta = (await res.json())?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? price;
    if (!Number.isFinite(price) || price <= 0) return null;
    return { price, chg: prev ? ((price - prev) / prev) * 100 : 0 };
  } catch { return null; }
}

/* ── GET /api/market ── */
app.get('/', async (c) => {
  if (listCache && Date.now() - listCache.at < TTL) {
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(listCache.data);
  }

  const db = c.get('db') as any;
  const env = ((c as any).env ?? {}) as Record<string, string | undefined>;

  /* 1) asset list: DB first, fallback built-in */
  let assets: { symbol: string; name: string; geckoId: string }[] = [];
  try {
    const rows = await db
      .select()
      .from(marketPrices)
      .where(eq(marketPrices.isActive, true))
      .orderBy(asc(marketPrices.sortOrder));
    assets = rows.map((r: any) => ({ symbol: r.symbol, name: r.name, geckoId: r.geckoId }));
  } catch {}
  if (!assets.length) assets = FALLBACK_ASSETS;

  /* 2) prices: Binance → CoinGecko (gaps) → Yahoo (gaps) */
  const prices = await binancePrices(assets.map(a => a.symbol));

  const missing = assets.filter(a => !prices.has(a.symbol));
  if (missing.length) {
    const g = await geckoPrices(missing.map(a => a.geckoId), env.COINGECKO_API_KEY);
    for (const a of missing) {
      const hit = g.get(a.geckoId);
      if (hit) prices.set(a.symbol, hit);
    }
  }

  const stillMissing = assets.filter(a => !prices.has(a.symbol));
  await Promise.all(stillMissing.map(async (a) => {
    const hit = await yahooPrice(`${a.symbol}-USD`);
    if (hit) prices.set(a.symbol, hit);
  }));

  /* 3) compose — always return the full list, never [] */
  const data: MarketItem[] = assets.map(a => ({
    symbol: a.symbol,
    name: a.name,
    logoUrl: GECKO_LOGOS[a.geckoId] ?? '',
    price: prices.get(a.symbol)?.price ?? 0,
    changePercent: prices.get(a.symbol)?.chg ?? 0,
  }));

  if (data.some(d => d.price > 0)) listCache = { at: Date.now(), data };
  const final = data.some(d => d.price > 0) ? data : (listCache?.data ?? data);

  c.header('Cache-Control', 'public, max-age=30');
  return c.json(final);
});

export default app;
