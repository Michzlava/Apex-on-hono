import { users, positions, transactions, activityLogs } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { Db } from '../db/client';

interface TradeParams {
  db: Db;
  userId: string;
  action: 'BUY' | 'SELL';
  asset: string;
  amount: number;
  price: number;
  leverage?: number;
  marginType?: string;
  marketType?: string;
}

export async function executeTrade(params: TradeParams) {
  const {
    db, userId, action, asset, amount, price,
    leverage = 1, marginType = 'ISOLATED', marketType = 'CRYPTO',
  } = params;

  if (!['BUY', 'SELL'].includes(action)) throw new Error('Invalid action');
  if (isNaN(amount) || amount <= 0)       throw new Error('Invalid amount');

  // ── Fetch user ────────────────────────────────────────────────────────────

  const [user] = await db
    .select({ id: users.id, portfolioBalance: users.portfolioBalance })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error('User not found');

  const balance = Number(user.portfolioBalance);

  if (action === 'BUY' && balance < amount) {
    throw new Error('Insufficient balance');
  }

  // ── SELL validation ───────────────────────────────────────────────────────

  let openPosForSell = null;
  if (action === 'SELL') {
    const results = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.userId, userId),
          eq(positions.symbol, asset),
          eq(positions.status, 'OPEN'),
          eq(positions.side, 'LONG'),
        ),
      )
      .limit(1);

    openPosForSell = results[0] ?? null;
    if (!openPosForSell) throw new Error(`No open ${asset} position to sell`);

    const positionValue = Number(openPosForSell.entryPrice) * Number(openPosForSell.quantity);
    if (amount > positionValue) throw new Error('Sell amount exceeds position value');
  }

  // ── Execute ───────────────────────────────────────────────────────────────

  // Neon HTTP doesn't support interactive transactions, so we run the
  // operations sequentially. If you upgrade to Neon's WebSocket driver
  // (neon-serverless) this can be wrapped in a real transaction.

  let sellPnl: number | null = null;
  if (action === 'SELL' && openPosForSell) {
    sellPnl = (price - Number(openPosForSell.entryPrice)) * Number(openPosForSell.quantity);
  }

  // 1. Insert transaction record
  const transactionId = createId();
  await db.insert(transactions).values({
    id: transactionId,
    userId,
    type: 'Trade' as any,
    asset: `${action}:${asset}`,
    amount: String(amount),
    price: String(price),
    action,
    leverage,
    pnl: sellPnl !== null ? String(sellPnl) : null,
    status: 'COMPLETED' as any,
  });

  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  const quantity = (amount * leverage) / price;

  // 2. Create or close position
  if (action === 'BUY') {
    await db.insert(positions).values({
      id: createId(),
      userId,
      asset,
      symbol: asset,
      quantity: String(quantity),
      entryPrice: String(price),
      currentPnl: '0',
      side: 'LONG',
      status: 'OPEN',
      leverage,
      marketType,
    });
  } else {
    const [openPos] = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.userId, userId),
          eq(positions.symbol, asset),
          eq(positions.status, 'OPEN'),
          eq(positions.side, 'LONG'),
        ),
      )
      .limit(1);

    if (openPos) {
      const pnl = (price - Number(openPos.entryPrice)) * Number(openPos.quantity);

      await db
        .update(positions)
        .set({ status: 'CLOSED', currentPnl: String(pnl), closedAt: new Date() })
        .where(eq(positions.id, openPos.id));

      await db
        .update(users)
        .set({ realisedPnl: String(Number(user.portfolioBalance) + pnl) })
        .where(eq(users.id, userId));
    }
  }

  // 3. Update balance
  const balanceDelta = action === 'BUY' ? -amount : amount;
  const newBalance = balance + balanceDelta;

  await db
    .update(users)
    .set({ portfolioBalance: String(newBalance), updatedAt: new Date() })
    .where(eq(users.id, userId));

  // 4. Activity log
  await db.insert(activityLogs).values({
    id: createId(),
    userId,
    description: `${action} ${asset} — $${amount.toLocaleString()} @ $${price.toLocaleString()}`,
  });

  return { transaction, newBalance };
}
