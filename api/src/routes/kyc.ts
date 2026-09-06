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

/* ── POST /api/user/kyc/upload — signed Cloudinary upload via Worker ── */
app.post('/upload', async (c) => {
  const env = c.env as any
  const CLOUD  = env.CLOUDINARY_CLOUD_NAME
  const KEY    = env.CLOUDINARY_API_KEY
  const SECRET = env.CLOUDINARY_API_SECRET
  if (!CLOUD || !KEY || !SECRET) return c.json({ error: 'Cloudinary not configured' }, 500)

  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return c.json({ error: 'No file provided' }, 400)
  if (file.size > 8 * 1024 * 1024) return c.json({ error: 'File too large (max 8 MB)' }, 400)

  // Cloudinary signed-upload signature: SHA1(sorted params + api_secret)
  const timestamp = Math.round(Date.now() / 1000)
  const toSign = `folder=apex-kyc&timestamp=${timestamp}`
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign + SECRET))
  const signature = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

  const out = new FormData()
  out.append('file', file)
  out.append('api_key', KEY)
  out.append('timestamp', String(timestamp))
  out.append('signature', signature)
  out.append('folder', 'apex-kyc')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: 'POST',
    body: out,
  })
  if (!res.ok) {
    console.error('[kyc upload] Cloudinary error:', res.status, await res.text().catch(() => ''))
    return c.json({ error: 'Upload failed' }, 502)
  }
  const data = await res.json()
  return c.json({ url: data.secure_url })
})

/* ── POST /api/user/kyc — record a submission (URLs come from /upload) ── */
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
