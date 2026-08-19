import { Hono } from 'hono';
import { db } from '../db/client';
import { users, transactions, positions, notifications, activityLogs, deposits } from '../db/schema';
import { eq, desc, and, sum, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

const app = new Hono();

// GET /api/user/dashboard - Fetch dashboard data
app.get('/', async (c) => {
  const userId = c.get('userId') as string;
  
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        portfolioBalance: users.portfolioBalance,
        portfolioChangePercent: users.portfolioChangePercent,
        realisedPnl: users.realisedPnl,
        volatility: users.volatility,
        riskLabel: users.riskLabel,
        kycStatus: users.kycStatus,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const [userTransactions, userPositions, userNotifications, userActivityLogs] = await Promise.all([
      db
        .select({
          id: transactions.id,
          type: transactions.type,
          asset: transactions.asset,
          amount: transactions.amount,
          status: transactions.status,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.createdAt))
        .limit(10),

      db
        .select()
        .from(positions)
        .where(eq(positions.userId, userId)),

      db
        .select({ id: notifications.id, message: notifications.message, read: notifications.read })
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(10),

      db
        .select({ id: activityLogs.id, description: activityLogs.description })
        .from(activityLogs)
        .where(eq(activityLogs.userId, userId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(10),
    ]);

    const openPositions = userPositions.filter(p => p.status === 'OPEN');
    const profitPositions = openPositions.filter(p => Number(p.currentPnl) > 0);
    const lossPositions = openPositions.filter(p => Number(p.currentPnl) <= 0);

    return c.json({
      user: {
        ...user,
        name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email,
        portfolioBalance: Number(user.portfolioBalance),
        portfolioChangePercent: Number(user.portfolioChangePercent),
        realisedPnl: Number(user.realisedPnl),
        volatility: Number(user.volatility),
      },
      transactions: userTransactions.map(t => ({
        ...t,
        amount: Number(t.amount),
      })),
      positions: {
        open: openPositions.length,
        profit: profitPositions.length,
        loss: lossPositions.length,
      },
      notifications: userNotifications,
      activityLogs: userActivityLogs,
    });

  } catch (error) {
    console.error('Dashboard GET error:', error);
    return c.json({ error: 'Failed to load dashboard' }, 500);
  }
});

// POST /api/user/dashboard - Update balance (admin/trade operations)
app.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const { amount, type, source, note } = body;

  if (!amount || amount <= 0) {
    return c.json({ error: 'Invalid amount' }, 400);
  }

  try {
    const [currentUser] = await db
      .select({ portfolioBalance: users.portfolioBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const currentBalance = Number(currentUser.portfolioBalance) || 0;

    let newBalance = currentBalance;
    if (type === 'add') newBalance = currentBalance + amount;
    else if (type === 'subtract') newBalance = currentBalance - amount;

    const [depositAgg] = await db
      .select({ total: sum(deposits.amount) })
      .from(deposits)
      .where(and(eq(deposits.userId, userId), eq(deposits.status, 'COMPLETED')));

    const totalDeposited = Number(depositAgg?.total) || 0;
    const newRealisedPnl = newBalance - totalDeposited;
    const newChangePercent = totalDeposited > 0
      ? ((newBalance - totalDeposited) / totalDeposited) * 100
      : 0;

    const txType =
      source === 'trade_profit' ? 'Trade' :
      source === 'trade_loss' ? 'Trade' :
      type === 'add' ? 'Deposit' :
      'Withdrawal';

    const txAction =
      source === 'trade_profit' ? 'Profit' :
      source === 'trade_loss' ? 'Loss' :
      note ? note :
      undefined;

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          previousBalance: String(currentBalance),
          portfolioBalance: String(newBalance),
          realisedPnl: String(newRealisedPnl),
          portfolioChangePercent: String(newChangePercent),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await tx.insert(transactions).values({
        id: createId(),
        userId,
        type: txType as any,
        amount: String(amount),
        status: 'COMPLETED' as any,
        asset: 'USD',
        ...(txAction ? { action: txAction } : {}),
      });
    });

    console.log(
      `[Balance] user=${userId} source=${source || type} ` +
      `old=${currentBalance} → new=${newBalance} ` +
      `pnl=${newRealisedPnl.toFixed(2)} pct=${newChangePercent.toFixed(2)}%`
    );

    return c.json({ success: true, newBalance });

  } catch (error) {
    console.error('Balance API Error:', error);
    return c.json({ error: 'Failed to update balance' }, 500);
  }
});

export default app;
