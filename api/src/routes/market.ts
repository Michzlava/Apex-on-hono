import { Hono } from 'hono';
import { marketPrices } from '../db/schema';
import { eq } from 'drizzle-orm';

const app = new Hono();

app.get('/', async (c) => {
  const db = c.get('db');

  try {
    const assets = await db
      .select()
      .from(marketPrices)
      .where(eq(marketPrices.isActive, true))
      .orderBy(marketPrices.sortOrder)
      .limit(6);

    const mockPrices: Record<string, { price: number; changePercent: number }> = {
      BTC: { price: 67420.50, changePercent: 2.38 },
      ETH: { price: 3512.10, changePercent: 3.01 },
      NVDA: { price: 875.40, changePercent: 4.62 },
      GOLD: { price: 2318.50, changePercent: -0.23 },
      'EUR/USD': { price: 1.0842, changePercent: 0.12 },
      TSLA: { price: 248.10, changePercent: -0.87 },
    };

    const result = assets.map(asset => ({
      symbol: asset.symbol,
      name: asset.name,
      logoUrl: asset.icon === '?' ? undefined : asset.icon,
      price: mockPrices[asset.symbol]?.price || 0,
      changePercent: mockPrices[asset.symbol]?.changePercent || 0,
    }));

    return c.json(result);
  } catch (error) {
    console.error('Market fetch error:', error);
    return c.json([]);
  }
});

export default app;
