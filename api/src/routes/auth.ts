import { Hono } from 'hono'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
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

// Helper: get secret as Uint8Array for jose
const getSecret = (secret: string) => new TextEncoder().encode(secret)

// Helper: manual cookie parse fallback (hono/cookie can be flaky on Workers)
function getTokenManual(c: any): string | undefined {
  const cookieHeader = c.req.header('Cookie') || ''
  const match = cookieHeader.match(/apex_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

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

    const secret = getSecret(c.env.JWT_SECRET)
    const token = await new SignJWT({
      sub: user.id,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret)

    setCookie(c, 'apex_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    console.log('[AUTH LOGIN] Cookie set. Token length:', token.length)

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
    console.error('[AUTH LOGIN] Error:', error)
    return c.json({ error: `Login failed: ${error.message}` }, 500)
  }
})

// ── ME ──
app.get('/me', async (c) => {
  const db = c.get('db')

  // Try hono/cookie first, then manual fallback
  let token = getCookie(c, 'apex_token') || getTokenManual(c)

  const rawCookieHeader = c.req.header('Cookie')

  console.log('[AUTH ME] Raw Cookie header:', rawCookieHeader)
  console.log('[AUTH ME] Token found:', token ? 'YES (length: ' + token.length + ')' : 'NO')

  if (!token) {
    return c.json({ user: null }, 401)
  }

  try {
    const secret = getSecret(c.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 })

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
  } catch (err: any) {
    console.error('[AUTH ME] JWT verify failed:', err.message)
    return c.json({ user: null }, 401)
  }
})

// ── DEBUG ── (temporary, remove after fix confirmed)
app.get('/debug', (c) => {
  return c.json({
    cookieHeader: c.req.header('Cookie'),
    tokenHono: getCookie(c, 'apex_token') ? 'present' : 'missing',
    tokenManual: getTokenManual(c) ? 'present' : 'missing',
  })
})

// ── LOGOUT ──
app.post('/logout', (c) => {
  deleteCookie(c, 'apex_token', { path: '/', secure: true, sameSite: 'Lax' })
  return c.json({ success: true })
})

export default app
