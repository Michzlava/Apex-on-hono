import { Hono } from 'hono';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';

const app = new Hono();

// Existing signup route...
app.post('/signup', async (c) => {
  // ... (keep existing signup code from previous step)
  const body = await c.req.json();
  const { name, email, phone, country, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required.' }, 400);
  }

  try {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: 'An account with this email already exists.' }, 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const nameParts = (name || '').trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    await db.insert(users).values({
      id: crypto.randomUUID(),
      firstName,
      lastName,
      email: email.toLowerCase().trim(),
      phone,
      country,
      password: hashedPassword,
    });

    return c.json({ success: true, message: 'Account created successfully.' });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});

// NEW: Login route
app.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required.' }, 400);
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.password) {
      return c.json({ error: 'Invalid email or password.' }, 401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return c.json({ error: 'Invalid email or password.' }, 401);
    }

    // Create JWT payload
    const payload = {
      sub: user.id,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    };

    const secret = process.env.JWT_SECRET!;
    if (!secret) throw new Error('JWT_SECRET not configured');

    const token = await sign(payload, secret);

    // Set httpOnly cookie
    setCookie(c, 'apex_token', token, {
      httpOnly: true,
      secure: true, // Always true in production (HTTPS)
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return c.json({ 
      success: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
});

export default app;
