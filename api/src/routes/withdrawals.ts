import { Hono } from 'hono'
import { withdrawals, users, activityLogs } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const app = new Hono()

// ── GET /api/user/withdrawals ─────────────────────────────────────────────────
app.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')

  try {
    const userWithdrawals = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.createdAt))

    return c.json({ withdrawals: userWithdrawals })
  } catch (error) {
    console.error('Withdrawals fetch error:', error)
    return c.json({ withdrawals: [] })
  }
})

// ── POST /api/user/withdrawals ────────────────────────────────────────────────
app.post('/', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')
  
  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { amount, currency, methodLabel, destination } = body

  if (!amount || Number(amount) <= 0) {
    return c.json({ error: 'Invalid amount' }, 400)
  }
  if (!destination || !destination.trim()) {
    return c.json({ error: 'Destination address/account is required' }, 400)
  }

  try {
    // 1. Check balance
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    if (!user) return c.json({ error: 'User not found' }, 404)

    const currentBalance = parseFloat(user.portfolioBalance)
    const withdrawAmount = Number(amount)

    if (currentBalance < withdrawAmount) {
      return c.json({ error: 'Insufficient balance' }, 400)
    }

    // 2. Deduct balance
    const newBalance = currentBalance - withdrawAmount
    await db
      .update(users)
      .set({
        portfolioBalance: newBalance.toString(),
        previousBalance: user.portfolioBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    // 3. Create withdrawal record
    const [withdrawal] = await db
      .insert(withdrawals)
      .values({
        id: crypto.randomUUID(),
        userId,
        amount: withdrawAmount.toString(),
        currency: currency || 'USD',
        status: 'PENDING_VERIFICATION',
        methodLabel: methodLabel || null,
        destination: destination.trim(),
        note: `Withdrawal requested to ${destination.trim()}`,
      })
      .returning()

    // 4. Log activity
    await db.insert(activityLogs).values({
      id: crypto.randomUUID(),
      userId,
      description: `Requested withdrawal of $${withdrawAmount} via ${methodLabel || 'external transfer'}`,
    })

    return c.json({ withdrawal }, 201)
  } catch (error: any) {
    console.error('Withdrawal creation error:', error)
    return c.json({ error: 'Failed to process withdrawal' }, 500)
  }
})

export default app
