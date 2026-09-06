import { Hono } from 'hono'
import { supportTickets, supportMessages, users } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const app = new Hono()

/* ── GET /api/admin/support/tickets — all tickets with user info ── */
app.get('/tickets', async (c) => {
  const db = c.get('db')

  try {
    const tickets = await db
      .select({
        id: supportTickets.id,
        userId: supportTickets.userId,
        subject: supportTickets.subject,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .orderBy(desc(supportTickets.createdAt))

    return c.json({ tickets })
  } catch (err: any) {
    console.error('[admin support] GET tickets failed:', err.message)
    return c.json({ error: 'Failed to load tickets' }, 500)
  }
})

/* ── GET /api/admin/support/messages/:ticketId — all messages for a ticket ── */
app.get('/messages/:ticketId', async (c) => {
  const db = c.get('db')
  const ticketId = c.req.param('ticketId')

  try {
    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt)

    return c.json({ messages })
  } catch (err: any) {
    console.error('[admin support] GET messages failed:', err.message)
    return c.json({ error: 'Failed to load messages' }, 500)
  }
})

/* ── POST /api/admin/support/messages — admin reply ── */
app.post('/messages', async (c) => {
  const db = c.get('db')
  const { ticketId, body } = await c.req.json().catch(() => ({}))

  if (!ticketId || !body || String(body).trim().length === 0) {
    return c.json({ error: 'Invalid request' }, 400)
  }

  try {
    const [message] = await db
      .insert(supportMessages)
      .values({
        id: crypto.randomUUID(),
        ticketId,
        sender: 'ADMIN',
        body: String(body).trim(),
      })
      .returning()

    return c.json({ message })
  } catch (err: any) {
    console.error('[admin support] POST message failed:', err.message)
    return c.json({ error: 'Failed to send message' }, 500)
  }
})

/* ── PATCH /api/admin/support/tickets/:id — update ticket status ── */
app.patch('/tickets/:id', async (c) => {
  const db = c.get('db')
  const ticketId = c.req.param('id')
  const { status } = await c.req.json().catch(() => ({}))

  if (!status || !['OPEN', 'CLOSED'].includes(status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  try {
    await db
      .update(supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))

    return c.json({ success: true })
  } catch (err: any) {
    console.error('[admin support] PATCH ticket failed:', err.message)
    return c.json({ error: 'Failed to update ticket' }, 500)
  }
})

export default app
