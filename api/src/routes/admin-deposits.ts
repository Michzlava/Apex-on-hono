import { Hono } from 'hono'
import { deposits, users, activityLogs } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const app = new Hono()

/* ── GET /api/admin/deposits — all deposits with user info ── */
app.get('/', async (c) => {
  const db = c.get('db')
  try {
    const rows = await db
      .select({
        id: deposits.id,
        amount: deposits.amount,
        currency: deposits.currency,
        status: deposits.status,
        methodLabel: deposits.methodLabel,
        note: deposits.note,
        adminNote: deposits.adminNote,
        createdAt: deposits.createdAt,
        updatedAt: deposits.updatedAt,
        userId: deposits.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(deposits)
      .leftJoin(users, eq(deposits.userId, users.id))
      .orderBy(desc(deposits.createdAt))

    const list = rows.map(r => ({
      id: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      methodLabel: r.methodLabel,
      note: r.note,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: {
        id: r.userId,
        name: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
        email: r.email,
      },
    }))

    return c.json({ deposits: list })
  } catch (err: any) {
    console.error('[admin deposits] GET failed:', err.message)
    return c.json({ error: 'Failed to load deposits' }, 500)
  }
})

/* ── PATCH /api/admin/deposits/:id — confirm or reject ── */
app.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const { action, adminNote } = await c.req.json().catch(() => ({}))

  if (action !== 'COMPLETED' && action !== 'REJECTED') {
    return c.json({ error: 'Invalid action' }, 400)
  }

  try {
    const [existing] = await db.select().from(deposits).where(eq(deposits.id, id))
    if (!existing) return c.json({ error: 'Deposit not found' }, 404)
    if (existing.status !== 'PENDING') {
      return c.json({ error: 'Deposit already processed' }, 400)
    }

    // On COMPLETED → credit user balance
    if (action === 'COMPLETED') {
      const [user] = await db.select().from(users).where(eq(users.id, existing.userId))
      if (user) {
        const prev = parseFloat(user.portfolioBalance) || 0
        const add = parseFloat(String(existing.amount)) || 0
        const next = prev + add
        await db
          .update(users)
          .set({
            portfolioBalance: next.toString(),
            previousBalance: user.portfolioBalance,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existing.userId))

        await db.insert(activityLogs).values({
          id: crypto.randomUUID(),
          userId: existing.userId,
          description: `Admin confirmed $${add.toFixed(2)} deposit`,
        })
      }
    }

    await db
      .update(deposits)
      .set({
        status: action,
        adminNote: adminNote ? String(adminNote).slice(0, 500) : null,
        updatedAt: new Date(),
      })
      .where(eq(deposits.id, id))

    return c.json({ success: true })
  } catch (err: any) {
    console.error('[admin deposits] PATCH failed:', err.message)
    return c.json({ error: 'Failed to process deposit' }, 500)
  }
})

export default app
