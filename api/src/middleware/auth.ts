import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'
import { getCookie } from 'hono/cookie'
import type { Db } from '../db/client'

type Variables = {
  db: Db
  userId: string
  userRole: string
}

function getTokenManual(c: any): string | undefined {
  const cookieHeader = c.req.header('Cookie') || ''
  const match = cookieHeader.match(/apex_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

const getSecret = (secret: string) => new TextEncoder().encode(secret)

export const authMiddleware = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const token = getCookie(c, 'apex_token') || getTokenManual(c)

  console.log('[AUTH MIDDLEWARE] Token:', token ? 'present' : 'MISSING')

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const secret = getSecret((c.env as any).JWT_SECRET)
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 })

    if (!payload.sub) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    c.set('userId', payload.sub as string)
    c.set('userRole', (payload.role as string) || 'user')

    await next()
  } catch (err: any) {
    console.error('[AUTH MIDDLEWARE] Verify failed:', err.message)
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
