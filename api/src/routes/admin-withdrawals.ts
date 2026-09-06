import { Hono } from 'hono'
import { withdrawals, users, activityLogs } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const app = new Hono()

/* ── GET /api/admin/withdrawals — all withdrawals with user info ── */
app.get('/', async (c) => {
  const db = c.get('db')
  try {
    const rows = await db
      .select({
        id: withdrawals.id,
        amount: withdrawals.amount,
        currency: withdrawals.currency,
        status: withdrawals.status,
        methodLabel: withdrawals.methodLabel,
        destination: withdrawals.destination,
        note: withdrawals.note,
        adminNote: withdrawals.adminNote,
        createdAt: withdrawals.createdAt,
        updatedAt: withdrawals.updatedAt,
        userId: withdrawals.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(withdrawals)
      .leftJoin(users, eq(withdrawals.userId, users.id))
      .orderBy(desc(withdrawals.createdAt))

    const list = rows.map(r => {
      // Build a "note" string the UI already knows how to parse
      // Format: <user-note> — <detail1> | <detail2> | ...
      // (AdminWithdrawalsPage.parseWithdrawalNote splits on ' — ' then on ' | ')
      const detailPairs: string[] = []
      if (r.methodLabel) detailPairs.push(`Coin: ${r.methodLabel}`)
      if (r.destination) detailPairs.push(`Wallet Address: ${r.destination}`)
      const detailStr = detailPairs.length ? detailPairs.join(' | ') : ''
      const assembledNote = [r.note, detailStr].filter(Boolean).join(' — ') || null

      return {
        id: r.id,
        amount: Number(r.amount),
        currency: r.currency,
        status: r.status,
        methodLabel: r.methodLabel,
        destination: r.destination,
        note: assembledNote,
        adminNote: r.adminNote,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        user: {
          id: r.userId,
          name: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
          email: r.email,
        },
      }
    })

    return c.json({ withdrawals: list })
  } catch (err: any) {
    console.error('[admin withdrawals] GET failed:', err.message)
    return c.json({ error: 'Failed to load withdrawals' }, 500)
  }
})

/* ── PATCH /api/admin/withdrawals/:id — approve or reject ── */
app.patch('/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const { action, adminNote } = await c.req.json().catch(() => ({}))

  if (action !== 'APPROVED' && action !== 'REJECTED') {
    return c.json({ error: 'Invalid action' }, 400)
  }

  try {
    const [existing] = await db.select().from(withdrawals).where(eq(withdrawals.id, id))
    if (!existing) return c.json({ error: 'Withdrawal not found' }, 404)

    if (existing.status !== 'PENDING_VERIFICATION' && existing.status !== 'PENDING') {
      return c.json({ error: 'Withdrawal already processed' }, 400)
    }

    const amt = parseFloat(String(existing.amount)) || 0

    // On REJECT → refund user balance (withdrawal deducted it at submission time)
    if (action === 'REJECTED') {
      const [user] = await db.select().from(users).where(eq(users.id, existing.userId))
      if (user) {
        const prev = parseFloat(user.portfolioBalance) || 0
        const next = prev + amt
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
          description: `Admin rejected $${amt.toFixed(2)} withdrawal — funds returned`,
        })
      }
    } else {
      // On APPROVE → funds are leaving the system, just log it
      await db.insert(activityLogs).values({
        id: crypto.randomUUID(),
        userId: existing.userId,
        description: `Admin approved $${amt.toFixed(2)} withdrawal`,
      })
    }

    await db
      .update(withdrawals)
      .set({
        status: action,
        adminNote: adminNote ? String(adminNote).slice(0, 500) : null,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, id))

    return c.json({ success: true })
  } catch (err: any) {
    console.error('[admin withdrawals] PATCH failed:', err.message)
    return c.json({ error: 'Failed to process withdrawal' }, 500)
  }
})

export default app
