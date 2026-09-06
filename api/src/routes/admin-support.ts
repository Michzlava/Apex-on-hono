import { Hono } from 'hono'
import { supportTickets, supportMessages, users } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const app = new Hono()

/* ── helper: ticket joined with its user ── */
async function ticketWithUser(db: any, ticketId: string) {
  const [row] = await db
    .select({
      id: supportTickets.id,
      userId: supportTickets.userId,
      subject: supportTickets.subject,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .where(eq(supportTickets.id, ticketId))

  if (!row) return null
  const user = {
    id: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
  }
  return {
    id: row.id,
    userId: row.userId,
    subject: row.subject,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user,
    userName: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email || 'Unknown',
    userFirstName: row.firstName,
    userLastName: row.lastName,
    userEmail: row.email,
  }
}

/* ── GET /tickets — all tickets with user info ── */
app.get('/tickets', async (c) => {
  const db = c.get('db')
  try {
    const rows = await db
      .select({
        id: supportTickets.id,
        userId: supportTickets.userId,
        subject: supportTickets.subject,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .orderBy(desc(supportTickets.createdAt))

    const tickets = rows.map(row => {
      const user = { id: row.userId, firstName: row.firstName, lastName: row.lastName, email: row.email }
      return {
        id: row.id,
        userId: row.userId,
        subject: row.subject,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        user,
        userName: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email || 'Unknown',
        userFirstName: row.firstName,
        userLastName: row.lastName,
        userEmail: row.email,
      }
    })

    return c.json({ tickets })
  } catch (err: any) {
    console.error('[admin support] GET tickets failed:', err.message)
    return c.json({ error: 'Failed to load tickets' }, 500)
  }
})

/* ── GET /tickets/:id — single ticket + user + messages ── */
app.get('/tickets/:id', async (c) => {
  const db = c.get('db')
  const ticketId = c.req.param('id')
  try {
    const ticket = await ticketWithUser(db, ticketId)
    if (!ticket) return c.json({ error: 'Ticket not found' }, 404)

    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt)

    return c.json({ ticket, user: ticket.user, messages })
  } catch (err: any) {
    console.error('[admin support] GET ticket failed:', err.message)
    return c.json({ error: 'Failed to load ticket' }, 500)
  }
})

/* ── GET /tickets/:id — single ticket + user + messages ── */
app.get('/tickets/:id', async (c) => {
  const db = c.get('db')
  const ticketId = c.req.param('id')
  try {
    const ticket = await ticketWithUser(db, ticketId)
    if (!ticket) return c.json({ error: 'Ticket not found' }, 404)

    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticketId))
      .orderBy(supportMessages.createdAt)

    // Embed messages inside the ticket object (frontend expects ticket.messages)
    const ticketWithMessages = { ...ticket, messages }

    return c.json({ ticket: ticketWithMessages })
  } catch (err: any) {
    console.error('[admin support] GET ticket failed:', err.message)
    return c.json({ error: 'Failed to load ticket' }, 500)
  }
})

/* ── POST /tickets/:id/messages — admin reply (nested, what the UI calls) ── */
app.post('/tickets/:id/messages', async (c) => {
  const db = c.get('db')
  const ticketId = c.req.param('id')
  const { body } = await c.req.json().catch(() => ({}))

  if (!body || String(body).trim().length === 0) {
    return c.json({ error: 'Message cannot be empty' }, 400)
  }

  try {
    const ticket = await ticketWithUser(db, ticketId)
    if (!ticket) return c.json({ error: 'Ticket not found' }, 404)

    const [message] = await db
      .insert(supportMessages)
      .values({
        id: crypto.randomUUID(),
        ticketId,
        sender: 'ADMIN',
        body: String(body).trim(),
      })
      .returning()

    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))

    return c.json({ success: true, message })
  } catch (err: any) {
    console.error('[admin support] POST reply failed:', err.message)
    return c.json({ error: 'Failed to send reply' }, 500)
  }
})

/* ── POST /messages — flat reply (ticketId in body) ── */
app.post('/messages', async (c) => {
  const db = c.get('db')
  const { ticketId, body } = await c.req.json().catch(() => ({}))
  if (!ticketId) return c.json({ error: 'ticketId required' }, 400)

  // delegate to the nested logic by re-using the handler path
  const ticket = await ticketWithUser(db, ticketId)
  if (!ticket) return c.json({ error: 'Ticket not found' }, 404)
  if (!body || String(body).trim().length === 0) return c.json({ error: 'Message cannot be empty' }, 400)

  try {
    const [message] = await db
      .insert(supportMessages)
      .values({ id: crypto.randomUUID(), ticketId, sender: 'ADMIN', body: String(body).trim() })
      .returning()
    return c.json({ success: true, message })
  } catch (err: any) {
    console.error('[admin support] POST flat reply failed:', err.message)
    return c.json({ error: 'Failed to send reply' }, 500)
  }
})

/* ── PATCH /tickets/:id — update status (OPEN / CLOSED) ── */
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

/* ── POST /tickets/:id/close — convenience close (in case UI uses it) ── */
app.post('/tickets/:id/close', async (c) => {
  const db = c.get('db')
  const ticketId = c.req.param('id')
  try {
    await db
      .update(supportTickets)
      .set({ status: 'CLOSED', updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))
    return c.json({ success: true })
  } catch (err: any) {
    console.error('[admin support] close failed:', err.message)
    return c.json({ error: 'Failed to close ticket' }, 500)
  }
})

export default app
