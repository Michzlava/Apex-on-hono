import { Hono } from 'hono'

const CACHE_TTL_MS = 30 * 1000
const priceCache = new Map<string, { price: number; change24h: number; fetchedAt: number; live: boolean }>()

// ── Hardcoded fallbacks (so UI never breaks) ──────────────────────
const FALLBACK_PRICES: Record<string, { price: number; change24h: number }> = {
  BTC:    { price: 71500,   change24h: 2.35 },
  ETH:    { price: 3850,    change24h: 1.80 },
  SOL:    { price: 168,     change24h: 4.20 },
  BNB:    { price: 605,     change24h: -0.50 },
  AAPL:   { price: 189.50,  change24h: 1.25 },
  TSLA:   { price: 245.30,  change24h: -0.85 },
  NVDA:   { price: 875.20,  change24h: 2.10 },
  MSFT:   { price: 420.15,  change24h: 0.65 },
  AMZN:   { price: 178.90,  change24h: -0.30 },
  GOOGL:  { price: 165.40,  change24h: 0.95 },
  USOIL:  { price: 78.45,   change24h: 1.50 },
  UKOIL:  { price: 82.30,   change24h: 1.35 },
  XAUUSD: { price: 2345.60, change24h: 0.45 },
  EURUSD: { price: 1.0845,  change24h: -0.15 },
  GBPUSD: { price: 1.2730,  change24h: 0.25 },
  USDJPY: { price: 151.45,  change24h: -0.35 },
}

// ── Symbol maps ───────────────────────────────────────────────────
const FINNHUB_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL']

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  USOIL: 'CL=F', UKOIL: 'BZ=F', XAUUSD: 'GC=F',
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'JPY=X',
}

const CRYPTO_GECKO_MAP: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
}

const app = new Hono()

app.get('/', async (c) => {
  const symbol = c.req.query('symbol')?.toUpperCase()
  if (!symbol) return c.json({ error: 'Missing symbol' }, 400)

  // Pull secrets from Worker env (NOT process.env)
  const env = (c.env ?? {}) as Record<string, string | undefined>
  const FINNHUB_KEY   = env.FINNHUB_API_KEY ?? ''
  const COINGECKO_KEY = env.COINGECKO_API_KEY ?? ''

  const fallback = FALLBACK_PRICES[symbol]
  const cached = priceCache.get(symbol)

  // Return fresh cache
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return c.json({
      symbol, price: cached.price, change24h: cached.change24h,
      live: true, source: 'cache',
    })
  }

  try {
    let price = 0
    let change24h = 0
    let source = ''

    /* ── STOCKS: Finnhub (works from Workers with key) ── */
    if (FINNHUB_SYMBOLS.includes(symbol)) {
      if (!FINNHUB_KEY) {
        console.warn(`[price] ${symbol}: FINNHUB_API_KEY missing, using fallback`)
      } else {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`
        )
        if (res.ok) {
          const data = await res.json()
          if (data.c > 0) {
            price = data.c
            change24h = data.dp ?? 0
            source = 'finnhub'
          }
        }
      }
    }
    /* ── COMMODITIES / FOREX: Yahoo (best-effort, often blocked) ── */
    else if (YAHOO_SYMBOL_MAP[symbol]) {
      const ticker = YAHOO_SYMBOL_MAP[symbol]
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`)
        if (res.ok) {
          const data = await res.json()
          const meta = data.chart?.result?.[0]?.meta
          if (meta?.regularMarketPrice > 0) {
            price = meta.regularMarketPrice
            const prev = meta.chartPreviousClose ?? meta.previousClose ?? price
            change24h = prev ? ((price - prev) / prev) * 100 : 0
            source = 'yahoo'
          }
        }
      } catch (e: any) {
        console.warn(`[price] ${symbol}: Yahoo failed — ${e.message}`)
      }
    }
    /* ── CRYPTO: CoinGecko (with key) → Binance fallback ── */
    else {
      const geckoId = CRYPTO_GECKO_MAP[symbol]
      if (!geckoId) {
        return c.json({ error: `Symbol ${symbol} not found` }, 404)
      }

      // Try CoinGecko with key header
      try {
        const headers: Record<string, string> = { 'Accept': 'application/json' }
        if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY

        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`,
          { headers }
        )
        if (res.ok) {
          const data = await res.json()
          if (data[geckoId]?.usd > 0) {
            price = data[geckoId].usd
            change24h = data[geckoId].usd_24h_change ?? 0
            source = 'coingecko'
          }
        }
      } catch (e: any) {
        console.warn(`[price] ${symbol}: CoinGecko failed — ${e.message}`)
      }

      // Binance fallback (try multiple domains for geo-blocked regions)
      if (!price) {
        const binanceDomains = [
          'https://api.binance.com',
          'https://api1.binance.com',
          'https://api2.binance.com',
          'https://api3.binance.com',
        ]
        for (const domain of binanceDomains) {
          try {
            const res = await fetch(
              `${domain}/api/v3/ticker/24hr?symbol=${symbol}USDT`
            )
            if (res.ok) {
              const data = await res.json()
              const p = parseFloat(data.lastPrice)
              if (p > 0) {
                price = p
                change24h = parseFloat(data.priceChangePercent) || 0
                source = 'binance'
                break
              }
            }
          } catch {}
        }
      }
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`No price obtained from any source`)
    }

    priceCache.set(symbol, { price, change24h, fetchedAt: Date.now(), live: true })
    return c.json({ symbol, price, change24h, live: true, source })
  }
  catch (err: any) {
    console.error(`[price] ${symbol} failed:`, err.message)

    // Stale cache > hardcoded fallback > error
    if (cached) {
      return c.json({
        symbol, price: cached.price, change24h: cached.change24h,
        live: false, source: 'stale-cache',
      })
    }
    if (fallback) {
      return c.json({
        symbol, price: fallback.price, change24h: fallback.change24h,
        live: false, source: 'fallback',
      })
    }
    return c.json({ error: 'Price unavailable' }, 502)
  }
})

export default app
