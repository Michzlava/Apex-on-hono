import { Hono } from 'hono'
import { kycSubmissions, users, activityLogs } from '../db/schema'
import { eq } from 'drizzle-orm'

const app = new Hono()

/* ── GET /api/user/kyc — current status + submission ── */
app.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')

  const [sub] = await db.select().from(kycSubmissions).where(eq(kycSubmissions.userId, userId))
  const [user] = await db.select({ kycStatus: users.kycStatus }).from(users).where(eq(users.id, userId))

  return c.json({ submission: sub ?? null, kycStatus: user?.kycStatus ?? 'NONE' })
})

/* ── POST /api/user/kyc — record a submission (URLs come from Cloudinary) ── */
app.post('/', async (c) => {
  const userId = c.get('userId')
  const db = c.get('db')
  const { frontUrl, backUrl, selfieUrl, documentType } = await c.req.json().catch(() => ({}))

  if (!frontUrl || !selfieUrl) {
    return c.json({ error: 'Document front and selfie are required' }, 400)
  }

  const [existing] = await db.select().from(kycSubmissions).where(eq(kycSubmissions.userId, userId))
  if (existing && existing.status === 'PENDING') {
    return c.json({ error: 'A submission is already under review' }, 400)
  }

  if (existing) {
    await db.update(kycSubmissions).set({
      frontUrl,
      backUrl: backUrl ?? null,
      selfieUrl,
      documentType: documentType ?? 'PASSPORT',
      status: 'PENDING',
      notes: null,
      submittedAt: new Date(),
      reviewedAt: null,
      updatedAt: new Date(),
    }).where(eq(kycSubmissions.id, existing.id))
  } else {
    await db.insert(kycSubmissions).values({
      id: crypto.randomUUID(),
      userId,
      frontUrl,
      backUrl: backUrl ?? null,
      selfieUrl,
      documentType: documentType ?? 'PASSPORT',
      status: 'PENDING',
    })
  }

  await db.update(users).set({ kycStatus: 'PENDING', updatedAt: new Date() }).where(eq(users.id, userId))
  await db.insert(activityLogs).values({
    id: crypto.randomUUID(),
    userId,
    description: 'Submitted KYC documents for review',
  })

  return c.json({ success: true })
})

export default app
