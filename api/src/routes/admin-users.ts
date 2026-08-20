import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { users, activityLogs } from '../db/schema';

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

  const {
    userId,
    portfolioBalance,
    portfolioChangePercent,
    realisedPnl,
    volatility,
    riskLabel,
  } = body;

  if (!userId) {
    return c.json({ error: 'userId required' }, 400);
  }

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
    .returning({
      id: users.id,
      portfolioBalance: users.portfolioBalance,
    });

  const balanceNum = Number(updated.portfolioBalance);

  await db.insert(activityLogs).values({
    id: crypto.randomUUID(),
    userId,
    description: `Admin updated portfolio balance to $${balanceNum.toLocaleString()}`,
  });

  return c.json({ success: true, portfolioBalance: balanceNum });
});

export default app;
