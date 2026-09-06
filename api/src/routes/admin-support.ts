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
