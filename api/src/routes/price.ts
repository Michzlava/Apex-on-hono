import { Hono } from 'hono'

const CACHE_TTL_MS = 30 * 1000
const priceCache = new Map<string, { price: number; change24h: number; fetchedAt: number }>()

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

  const cached = priceCache.get(symbol)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return c.json({ symbol, price: cached.price, change24h: cached.change24h })
  }

  try {
    let price = 0
    let change24h = 0

    if (YAHOO_SYMBOL_MAP[symbol]) {
      // ── Stocks, Forex, Commodities via Yahoo Finance ──
      const ticker = YAHOO_SYMBOL_MAP[symbol]
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`)
      if (!res.ok) throw new Error('Yahoo fetch failed')
      const data = await res.json()
      const meta = data.chart.result[0].meta
      price = meta.regularMarketPrice
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price
      change24h = ((price - prevClose) / prevClose) * 100

    } else {
      // ── Crypto ──
      let geckoId = CRYPTO_GECKO_MAP[symbol]

      if (!geckoId) {
        return c.json({ error: `Symbol ${symbol} not found` }, 404)
      }

      // Primary: CoinGecko
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_24hr_change=true`,
          { cf: { cacheTtl: 30 } } as any
        )
        if (res.ok) {
          const data = await res.json()
          price = data[geckoId]?.usd
          change24h = data[geckoId]?.usd_24h_change ?? 0
        }
      } catch {}

      // Fallback: Binance
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

    priceCache.set(symbol, { price, change24h, fetchedAt: Date.now() })
    return c.json({ symbol, price, change24h })

  } catch (err: any) {
    // Return stale cache if available
    if (cached) {
      return c.json({ symbol, price: cached.price, change24h: cached.change24h })
    }
    return c.json({ error: 'Price unavailable' }, 502)
  }
})

export default app
