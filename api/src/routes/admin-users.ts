import { Hono } from 'hono';
import { eq, desc, and, sum } from 'drizzle-orm';
import { users, activityLogs, transactions, deposits } from '../db/schema';
import bcrypt from 'bcryptjs';

const app = new Hono();

function isAdmin(c: any) {
  return c.get('userRole') === 'ADMIN';
}

function buildName(user: { firstName: string | null; lastName: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null;
}

// GET /api/admin/users — list all users
app.get('/', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');

  const allUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: users.role,
      portfolioBalance: users.portfolioBalance,
      kycStatus: users.kycStatus,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const usersWithName = allUsers.map(u => ({
    ...u,
    name: buildName(u),
    portfolioBalance: Number(u.portfolioBalance),
  }));

  return c.json(usersWithName);
});

// PATCH /api/admin/users — adjust user balance/stats
app.patch('/', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');
  const body = await c.req.json();

  const { userId, portfolioBalance, portfolioChangePercent, realisedPnl, volatility, riskLabel } = body;
  if (!userId) return c.json({ error: 'userId required' }, 400);

  const [updated] = await db
    .update(users)
    .set({
      ...(portfolioBalance !== undefined && { portfolioBalance: String(portfolioBalance) }),
      ...(portfolioChangePercent !== undefined && { portfolioChangePercent: String(portfolioChangePercent) }),
      ...(realisedPnl !== undefined && { realisedPnl: String(realisedPnl) }),
      ...(volatility !== undefined && { volatility: String(volatility) }),
      ...(riskLabel !== undefined && { riskLabel }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id, portfolioBalance: users.portfolioBalance });

  const balanceNum = Number(updated.portfolioBalance);

  await db.insert(activityLogs).values({
    id: crypto.randomUUID(),
    userId,
    description: `Admin updated portfolio balance to $${balanceNum.toLocaleString()}`,
  });

  return c.json({ success: true, portfolioBalance: balanceNum });
});

// GET /api/admin/users/:id — get single user
app.get('/:id', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');
  const id = c.req.param('id');

  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      country: users.country,
      role: users.role,
      kycStatus: users.kycStatus,
      portfolioBalance: users.portfolioBalance,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return c.json({ error: 'User not found' }, 404);

  return c.json({
    user: {
      ...user,
      name: buildName(user),
      portfolioBalance: Number(user.portfolioBalance),
    },
  });
});

// PUT /api/admin/users/:id — update user details
app.put('/:id', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json();

  const { name, email, phone, country, kycStatus, portfolioBalance } = body;
  const validKyc = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'] as const;

  let firstName: string | undefined;
  let lastName: string | null | undefined;
  if (name !== undefined) {
    const parts = name.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ') || null;
  }

  const [user] = await db
    .update(users)
    .set({
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(country !== undefined && { country }),
      ...(kycStatus && validKyc.includes(kycStatus) && { kycStatus }),
      ...(portfolioBalance !== undefined && { portfolioBalance: String(portfolioBalance) }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      country: users.country,
      role: users.role,
      kycStatus: users.kycStatus,
      portfolioBalance: users.portfolioBalance,
      createdAt: users.createdAt,
    });

  return c.json({
    user: {
      ...user,
      name: buildName(user),
      portfolioBalance: Number(user.portfolioBalance),
    },
  });
});

// POST /api/admin/users/:id/balance — add/subtract balance
app.post('/:id/balance', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');
  const id = c.req.param('id');
  const { amount, type, source, note } = await c.req.json();

  if (!amount || isNaN(parseFloat(amount))) {
    return c.json({ error: 'Valid amount is required' }, 400);
  }
  if (!['add', 'subtract'].includes(type)) {
    return c.json({ error: 'type must be add or subtract' }, 400);
  }

  const parsedAmount = parseFloat(amount);

  try {
    // Step 1: fetch current user
    const [currentUser] = await db
      .select({
        portfolioBalance: users.portfolioBalance,
        realisedPnl: users.realisedPnl,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!currentUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Step 2: compute new values
    const currentBalance = Number(currentUser.portfolioBalance) || 0;
    const delta = type === 'add' ? parsedAmount : -parsedAmount;
    const newBalance = currentBalance + delta;

    const isDeposit = type === 'add' && !source?.startsWith('trade');
    const pnlDelta = isDeposit ? 0 : delta;
    const newRealisedPnl = (Number(currentUser.realisedPnl) || 0) + pnlDelta;

    // Step 3: aggregate completed deposits for change %
    const depositAgg = await db
      .select({ total: sum(deposits.amount) })
      .from(deposits)
      .where(and(eq(deposits.userId, id), eq(deposits.status, 'COMPLETED')));

    const totalDeposited = Number(depositAgg[0]?.total) || 0;
    const newChangePercent = totalDeposited > 0
      ? (newRealisedPnl / totalDeposited) * 100
      : 0;

    // Step 4: update user
    const [updatedUser] = await db
      .update(users)
      .set({
        previousBalance: String(currentBalance),
        portfolioBalance: String(newBalance),
        realisedPnl: String(newRealisedPnl),
        portfolioChangePercent: String(newChangePercent),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        portfolioBalance: users.portfolioBalance,
        realisedPnl: users.realisedPnl,
        portfolioChangePercent: users.portfolioChangePercent,
        previousBalance: users.previousBalance,
      });

    // Step 5: insert transaction record
    const txType =
      source === 'trade_profit' ? 'Trade' :
      source === 'trade_loss'   ? 'Trade' :
      type === 'add'            ? 'Deposit' :
                                  'Withdrawal';

    const txAction =
      source === 'trade_profit' ? 'Profit' :
      source === 'trade_loss'   ? 'Loss' :
      note                      ? note :
                                  undefined;

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId: id,
      type: txType,
      amount: String(parsedAmount),
      status: 'COMPLETED',
      asset: 'USD',
      ...(txAction ? { action: txAction } : {}),
    });

    console.log(
      `[Admin Balance] user=${id} source=${source || type} ` +
      `old=${currentBalance} → new=${newBalance} ` +
      `pnlDelta=${pnlDelta} ` +
      `pnl=${newRealisedPnl.toFixed(2)} pct=${newChangePercent.toFixed(2)}%`
    );

    return c.json({ user: updatedUser });
  } catch (err: any) {
    console.error('[Admin Balance] Error:', err);
    return c.json({ error: err.message || 'Failed' }, 500);
  }
});

// POST /api/admin/users/:id/password — reset password
app.post('/:id/password', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');
  const id = c.req.param('id');
  const { password } = await c.req.json();

  if (!password || password.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }

  const hashed = await bcrypt.hash(password, 12);

  await db
    .update(users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(users.id, id));

  return c.json({ success: true });
});

export default app;
