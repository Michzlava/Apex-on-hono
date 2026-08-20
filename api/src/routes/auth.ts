import { Hono } from 'hono'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { sign, verify } from 'hono/jwt'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import type { Db } from '../db/client'

type Bindings = {
  JWT_SECRET: string
  DATABASE_URL: string
}

type Variables = {
  db: Db
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ── SIGNUP ──
app.post('/signup', async (c) => {
  const db = c.get('db')
  const body = await c.req.json()
  const { name, email, phone, country, password } = body

  if (!email || !password) {
    return c.json({ error: 'Email and password are required.' }, 400)
  }

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1)

    if (existing) {
      return c.json({ error: 'An account with this email already exists.' }, 409)
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const nameParts = (name || '').trim().split(' ')

    await db.insert(users).values({
      id: crypto.randomUUID(),
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      email: email.toLowerCase().trim(),
      phone,
      country,
      password: hashedPassword,
    })

    return c.json({ success: true })
  } catch (error: any) {
    console.error('Signup error:', error)
    return c.json({ error: `Signup failed: ${error.message}` }, 500)
  }
})

// ── LOGIN ──
app.post('/login', async (c) => {
  const db = c.get('db')
  const { email, password } = await c.req.json()

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, (email || '').toLowerCase().trim()))
      .limit(1)

    if (!user || !user.password) {
      return c.json({ error: 'Invalid email or password.' }, 401)
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return c.json({ error: 'Invalid email or password.' }, 401)
    }

    const token = await sign({
      sub: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    }, c.env.JWT_SECRET)

    setCookie(c, 'apex_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        role: user.role,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return c.json({ error: `Login failed: ${error.message}` }, 500)
  }
})

// ── ME ──
app.get('/me', async (c) => {
  const db = c.get('db')
  const token = getCookie(c, 'apex_token')

  // Temporary diagnostic: check Wrangler logs after a refresh to see if the cookie arrives
  console.log('[AUTH /me] Cookie header:', c.req.header('Cookie'))
  console.log('[AUTH /me] Token parsed:', token ? 'present' : 'MISSING')

  if (!token) {
    return c.json({ user: null }, 401)
  }

  try {
    const payload = await verify(token, c.env.JWT_SECRET)
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, payload.sub as string))
      .limit(1)

    if (!user) {
      return c.json({ user: null }, 401)
    }

    return c.json({ user })
  } catch (err) {
    console.error('[AUTH /me] Token verification failed:', err)
    return c.json({ user: null }, 401)
  }
})

// ── LOGOUT ──
app.post('/logout', (c) => {
  deleteCookie(c, 'apex_token', { path: '/' })
  return c.json({ success: true })
})

export default app
