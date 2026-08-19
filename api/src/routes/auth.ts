import { Hono } from 'hono';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = new Hono();

app.post('/signup', async (c) => {
  const body = await c.req.json();
  const { name, email, phone, country, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required.' }, 400);
  }

  try {
    // Check if user already exists
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      return c.json({ error: 'An account with this email already exists.' }, 409);
    }

    // Hash password (cost 10 is safe and fast enough with bcryptjs on edge)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Split name into first/last (basic logic)
    const nameParts = (name || '').trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // Insert user
    await db.insert(users).values({
      id: crypto.randomUUID(), // Native in Cloudflare Workers with nodejs_compat
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

export default app;
