import { Hono } from 'hono'

// CoinGecko ID mapping for crypto
const COINGECKO_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
}

// Realistic mock data for stocks / forex / commodities
const MOCK_PRICES: Record<string, { price: number; change24h: number }> = {
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

const app = new Hono()

app.get('/', async (c) => {
  const symbol = c.req.query('symbol')
  if (!symbol) return c.json({ error: 'Missing symbol' }, 400)

  const base = symbol.toUpperCase().replace('USD', '').replace('USDT', '')

  // ── Crypto: fetch from CoinGecko with Cloudflare edge caching ──
  if (COINGECKO_MAP[base]) {
    try {
      const id = COINGECKO_MAP[base]
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`,
        { cf: { cacheTtl: 60 } } // Cache 60s on Cloudflare edge
      )
      if (!res.ok) throw new Error('CoinGecko failed')
      const data = await res.json()
      const coin = data[id]
      return c.json({
        price: Number(coin.usd),
        change24h: Number(coin.usd_24h_change ?? 0),
      })
    } catch (err) {
      console.error('[price] CoinGecko error:', err)
      // Fall through to mock if API fails
    }
  }

  // ── Stocks / Forex / Commodities: mock with tiny jitter ──
  const mock = MOCK_PRICES[symbol.toUpperCase()]
  if (mock) {
    const jitter = (Math.random() - 0.5) * 0.005 // ±0.25%
    return c.json({
      price: Number((mock.price * (1 + jitter)).toFixed(4)),
      change24h: mock.change24h,
    })
  }

  return c.json({ error: 'Unknown symbol' }, 404)
})

export default app
