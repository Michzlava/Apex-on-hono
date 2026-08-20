import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { users, positions, transactions } from '../db/schema'
import { authMiddleware } from '../middleware/auth'
import type { Db } from '../db/client'

type Variables = {
  db: Db
  userId: string
  userRole: string
}

const assetsRoute = new Hono<{ Variables: Variables }>()

assetsRoute.get('/', authMiddleware, async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')

  const [userRow] = await db
    .select({
      id: users.id,
      portfolioBalance: users.portfolioBalance,
      realisedPnl: users.realisedPnl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userRow) {
    return c.json({ error: 'User not found' }, 404)
  }

  const [userPositions, userTrades] = await Promise.all([
    db
      .select()
      .from(positions)
      .where(eq(positions.userId, userRow.id))
      .orderBy(desc(positions.openedAt)),

    db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userRow.id),
        eq(transactions.type, 'Trade')
      ))
      .orderBy(desc(transactions.createdAt)),
  ])

  return c.json({
    portfolioBalance: Number(userRow.portfolioBalance),
    realisedPnl: Number(userRow.realisedPnl),
    positions: userPositions.map(p => ({
      ...p,
      quantity: Number(p.quantity),
      entryPrice: Number(p.entryPrice),
      currentPnl: Number(p.currentPnl),
      leverage: Number(p.leverage),
    })),
    trades: userTrades.map(t => ({
      ...t,
      amount: Number(t.amount),
      price: t.price ? Number(t.price) : null,
      leverage: t.leverage ? Number(t.leverage) : null,
      pnl: t.pnl ? Number(t.pnl) : null,
    })),
  })
})

export default assetsRoute
