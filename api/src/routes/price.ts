import { Hono } from 'hono'

const CACHE_TTL_MS = 30 * 1000
const priceCache = new Map<string, { price: number; change24h: number; fetchedAt: number; live: boolean }>()

// ── Hardcoded fallback prices (so the UI never breaks) ────────────────────────

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

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  USOIL:  'CL=F',
  UKOIL:  'BZ=F',
  XAUUSD: 'GC=F',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'JPY=X',
  AAPL:   'AAPL',
  TSLA:   'TSLA',
  NVDA:   'NVDA',
  MSFT:   'MSFT',
  AMZN:   'AMZN',
  GOOGL:  'GOOGL',
}

const CRYPTO_GECKO_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
}

const app = new Hono()

app.get('/', async (c) => {
  const symbol = c.req.query('symbol')?.toUpperCase()
  if (!symbol) return c.json({ error: 'Missing symbol' }, 400)

  const fallback = FALLBACK_PRICES[symbol]
  const cached = priceCache.get(symbol)

  // Return cached live data if fresh
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return c.json({ symbol, price: cached.price, change24h: cached.change24h, live: true })
  }

  // Try to fetch live price
  try {
    let price = 0
    let change24h = 0

    if (YAHOO_SYMBOL_MAP[symbol]) {
      // Stocks, Forex, Commodities
      const ticker = YAHOO_SYMBOL_MAP[symbol]
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`, {
        cf: { cacheTtl: 60 } as any
      })
      if (!res.ok) throw new Error(`Yahoo ${res.status}`)
      const data = await res.json()
      const meta = data.chart.result[0].meta
      price = meta.regularMarketPrice
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
      change24h = ((price - prevClose) / prevClose) * 100

    } else {
      // Crypto
      const geckoId = CRYPTO_GECKO_MAP[symbol]
      if (!geckoId) throw new Error('Unknown crypto symbol')

      // CoinGecko
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`,
          { cf: { cacheTtl: 60 } as any }
        )
        if (res.ok) {
          const data = await res.json()
          price = data[geckoId]?.usd
          change24h = data[geckoId]?.usd_24h_change ?? 0
        }
      } catch {}

      // Binance fallback
      if (!price) {
        try {
          const binanceSymbol = `${symbol}USDT`
          const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`)
          if (res.ok) {
            const data = await res.json()
            price = parseFloat(data.lastPrice)
            change24h = parseFloat(data.priceChangePercent)
          }
        } catch {}
      }
    }

    if (!Number.isFinite(price) || price === 0) throw new Error('Invalid price')

    // Store live price
    priceCache.set(symbol, { price, change24h, fetchedAt: Date.now(), live: true })
    return c.json({ symbol, price, change24h, live: true })

  } catch (err: any) {
    console.error(`[price] Live fetch failed for ${symbol}:`, err.message || err)

    // Return stale cache if available
    if (cached) {
      return c.json({ symbol, price: cached.price, change24h: cached.change24h, live: false })
    }

    // Return hardcoded fallback so UI never breaks
    if (fallback) {
      return c.json({ symbol, price: fallback.price, change24h: fallback.change24h, live: false })
    }

    return c.json({ error: 'Price unavailable' }, 502)
  }
})

export default app
