import { Hono } from 'hono'
import { supportTickets, supportMessages } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const app = new Hono()

/* ── GET /api/support/thread ── */
app.get('/thread', async (c) => {
  const userId = c.get('userId') as string | undefined
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const db = c.get('db')

  try {
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt))
      .limit(1)

    const ticket = tickets[0]
    if (!ticket) return c.json({ ticketId: null, status: null, messages: [] })

    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticket.id))
      .orderBy(supportMessages.createdAt)

    return c.json({ ticketId: ticket.id, status: ticket.status, messages })
  } catch (err: any) {
    console.error('[support] GET thread failed:', err.message)
    return c.json({ error: 'Failed to load thread' }, 500)
  }
})

/* ── POST /api/support/thread/messages ── */
app.post('/thread/messages', async (c) => {
  const userId = c.get('userId') as string | undefined
  if (!userId) return c.json({ error: 'Unauthorized' }, 401)
  const db = c.get('db')

  const { body } = await c.req.json().catch(() => ({}))
  if (!body || String(body).trim().length === 0) {
    return c.json({ error: 'Message cannot be empty' }, 400)
  }

  try {
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt))
      .limit(1)

    let ticket = tickets[0]

    if (!ticket || ticket.status === 'CLOSED') {
      const [newTicket] = await db
        .insert(supportTickets)
        .values({
          id: crypto.randomUUID(),
          userId,
          subject: 'Support Request',
          status: 'OPEN',
        })
        .returning()
      ticket = newTicket
    }

    const [message] = await db
      .insert(supportMessages)
      .values({
        id: crypto.randomUUID(),
        ticketId: ticket.id,
        sender: 'USER',
        body: String(body).trim(),
      })
      .returning()

    return c.json({ ticketId: ticket.id, status: ticket.status, message })
  } catch (err: any) {
    console.error('[support] POST message failed:', err.message)
    return c.json({ error: 'Failed to send message' }, 500)
  }
})

export default app
