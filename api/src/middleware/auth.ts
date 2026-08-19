import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { getCookie } from 'hono/cookie'

type Bindings = {
  JWT_SECRET: string
}

export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const token = getCookie(c, 'apex_token')

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET)
    c.set('userId', payload.sub as string)
    c.set('userRole', payload.role as string)
    await next()
  } catch (e) {
    return c.json({ error: 'Invalid token' }, 401)
  }
})
