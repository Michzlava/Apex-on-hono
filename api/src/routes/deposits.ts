import { Hono } from 'hono';
import { db } from '../db/client';
import { deposits } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

const app = new Hono();

// GET /api/user/deposits - Fetch user's deposit history
app.get('/', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const userDeposits = await db
      .select({
        id: deposits.id,
        amount: deposits.amount,
        currency: deposits.currency,
        status: deposits.status,
        methodLabel: deposits.methodLabel,
        createdAt: deposits.createdAt,
      })
      .from(deposits)
      .where(eq(deposits.userId, userId))
      .orderBy(desc(deposits.createdAt))
      .limit(50);

    return c.json({
      deposits: userDeposits.map(d => ({
        ...d,
        amount: Number(d.amount),
      })),
    });
  } catch (error) {
    console.error('Deposit history error:', error);
    return c.json({ error: 'Failed to load deposits' }, 500);
  }
});

// POST /api/user/deposits - Submit a new deposit request
app.post('/', async (c) => {
  const userId = c.get('userId') as string;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const { amount, currency, methodLabel } = body;

  if (!amount || amount <= 0) {
    return c.json({ error: 'Invalid amount' }, 400);
  }

  try {
    await db.insert(deposits).values({
      id: createId(),
      userId,
      amount: String(amount),
      currency: currency || 'USD',
      status: 'PENDING',
      methodLabel: methodLabel || null,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Deposit submission error:', error);
    return c.json({ error: 'Failed to submit deposit' }, 500);
  }
});

export default app;
