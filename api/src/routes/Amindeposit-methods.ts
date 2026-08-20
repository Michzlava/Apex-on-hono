import { Hono } from 'hono'
import { eq, asc } from 'drizzle-orm'
import { depositMethods } from '../db/schema'
import type { Db } from '../db/client'

type Variables = {
  db: Db
  userId: string
  userRole: string
}

const app = new Hono<{ Variables: Variables }>()

// GET /api/admin/deposit-methods — active methods for deposit sheet
app.get('/', async (c) => {
  const db = c.get('db')

  const methods = await db
    .select({
      id: depositMethods.id,
      label: depositMethods.label,
      icon: depositMethods.icon,
      address: depositMethods.address,
      network: depositMethods.network,
      note: depositMethods.note,
    })
    .from(depositMethods)
    .where(eq(depositMethods.isActive, true))
    .orderBy(asc(depositMethods.sortOrder))

  return c.json(methods)
})

// GET /api/admin/deposit-methods/manage — all methods for admin
app.get('/manage', async (c) => {
  const db = c.get('db')

  const methods = await db
    .select()
    .from(depositMethods)
    .orderBy(asc(depositMethods.sortOrder))

  return c.json(methods)
})

// POST /api/admin/deposit-methods/manage — create
app.post('/manage', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  await db.insert(depositMethods).values({
    id: crypto.randomUUID(),
    label: body.label,
    icon: body.icon,
    address: body.address,
    network: body.network || null,
    note: body.note || null,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder ?? 0,
  })

  return c.json({ success: true })
})

// PATCH /api/admin/deposit-methods/manage — update
app.patch('/manage', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()

  if (!body.id) {
    return c.json({ error: 'ID required' }, 400)
  }

  await db
    .update(depositMethods)
    .set({
      ...(body.label !== undefined && { label: body.label }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.network !== undefined && { network: body.network || null }),
      ...(body.note !== undefined && { note: body.note || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(depositMethods.id, body.id))

  return c.json({ success: true })
})

// DELETE /api/admin/deposit-methods/manage — delete
app.delete('/manage', async (c) => {
  const db = c.get('db')
  const id = c.req.query('id')

  if (!id) {
    return c.json({ error: 'ID required' }, 400)
  }

  await db
    .delete(depositMethods)
    .where(eq(depositMethods.id, id))

  return c.json({ success: true })
})

export default app
