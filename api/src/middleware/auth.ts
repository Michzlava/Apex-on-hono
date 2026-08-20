import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { getCookie } from 'hono/cookie'
import type { Db } from '../db/client'

type Variables = {
  db: Db
  userId: string
  userRole: string
}

export const authMiddleware = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const token = getCookie(c, 'apex_token')

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await verify(token, (c.env as any).JWT_SECRET)

    if (!payload.sub) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    c.set('userId', payload.sub as string)
    c.set('userRole', (payload.role as string) || 'user')

    await next()
  } catch (err) {
    console.error('[authMiddleware] Verification failed:', err)
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
