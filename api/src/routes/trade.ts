import { Hono } from 'hono';
import { executeTrade } from '../lib/tradeService';

const app = new Hono();

app.post('/', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Unauthorised' }, 401);

  try {
    const body = await c.req.json();
    const { action, asset, amount, price, leverage, marginType, marketType } = body;

    if (!action || !asset || !amount || !price) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const result = await executeTrade({
      db: c.get('db'),
      userId,
      action,
      asset,
      amount: Number(amount),
      price: Number(price),
      leverage: leverage || 1,
      marginType: marginType || 'ISOLATED',
      marketType: marketType || 'CRYPTO',
    });

    return c.json({
      success: true,
      trade: result.transaction,
      newBalance: result.newBalance,
    });
  } catch (err: any) {
    console.error('[trade] error:', err?.message);
    return c.json({ error: err?.message ?? 'Internal server error' }, 500);
  }
});

export default app;
