import { Hono } from 'hono'
import { users, activityLogs } from '../db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const app = new Hono()

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/* ── GET /api/user/settings — profile fields ── */
app.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')

  const [user] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      country: users.country,
    })
    .from(users)
    .where(eq(users.id, userId))

  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

/* ── PUT /api/user/settings — update profile ── */
app.put('/', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')
  const body = await c.req.json().catch(() => ({}))

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (body.firstName !== undefined) updates.firstName = String(body.firstName).slice(0, 60) || null
  if (body.lastName  !== undefined) updates.lastName  = String(body.lastName).slice(0, 60) || null
  if (body.phone     !== undefined) updates.phone     = String(body.phone).slice(0, 30) || null
  if (body.country   !== undefined) updates.country   = String(body.country).slice(0, 60) || null

  const [user] = await db.update(users).set(updates).where(eq(users.id, userId)).returning()
  if (!user) return c.json({ error: 'User not found' }, 404)

  return c.json({ success: true })
})

/* ── POST /api/user/settings/password ── */


app.post('/password', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')
  const { currentPassword, newPassword } = await c.req.json().catch(() => ({}))

  if (!currentPassword || !newPassword) return c.json({ error: 'Both passwords are required' }, 400)
  if (String(newPassword).length < 8) return c.json({ error: 'New password must be at least 8 characters' }, 400)

  const [user] = await db.select({ password: users.password }).from(users).where(eq(users.id, userId))
  if (!user) return c.json({ error: 'User not found' }, 404)

  const valid = await bcrypt.compare(String(currentPassword), user.password ?? '')
  if (!valid) return c.json({ error: 'Current password is incorrect' }, 400)

  const hashedNew = await bcrypt.hash(String(newPassword), 10)
  await db.update(users).set({ password: hashedNew, updatedAt: new Date() }).where(eq(users.id, userId))
  await db.insert(activityLogs).values({
    id: crypto.randomUUID(),
    userId,
    description: 'Changed account password',
  })

  return c.json({ success: true })
})

export default app
