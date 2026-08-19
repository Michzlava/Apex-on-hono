import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { getCookie } from 'hono/cookie'

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, 'apex_token')
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const secret = process.env.JWT_SECRET!
    if (!secret) {
      throw new Error('JWT_SECRET not configured')
    }
    
    const payload = await verify(token, secret)
    c.set('userId', payload.sub as string)
    c.set('userRole', payload.role as string)
    await next()
  } catch (e) {
    return c.json({ error: 'Invalid token' }, 401)
  }
})
