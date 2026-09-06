import { Hono } from 'hono'
import { supportTickets, supportMessages } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const app = new Hono()

/* ── GET /api/support/thread — current ticket + messages ── */
app.get('/thread', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')

  // Find most recent ticket (OPEN preferred, then any)
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(1)

  const ticket = tickets[0]
  if (!ticket) {
    return c.json({ ticketId: null, status: null, messages: [] })
  }

  const messages = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticket.id))
    .orderBy(supportMessages.createdAt)

  return c.json({
    ticketId: ticket.id,
    status: ticket.status,
    messages,
  })
})

/* ── POST /api/support/thread/messages — send message (creates ticket if needed) ── */
app.post('/thread/messages', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')
  const { body } = await c.req.json().catch(() => ({}))

  if (!body || String(body).trim().length === 0) {
    return c.json({ error: 'Message cannot be empty' }, 400)
  }

  // Find or create ticket
  const tickets = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.createdAt))
    .limit(1)

  let ticket = tickets[0]

  if (!ticket || ticket.status === 'CLOSED') {
    // Create new ticket
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

  // Insert message
  const [message] = await db
    .insert(supportMessages)
    .values({
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      sender: 'USER',
      body: String(body).trim(),
    })
    .returning()

  return c.json({
    ticketId: ticket.id,
    status: ticket.status,
    message,
  })
})

export default app
