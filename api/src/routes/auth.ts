import { Hono } from 'hono';
import { db } from '../db/client';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

const app = new Hono();

// ... existing signup and login routes ...

// NEW: Get current user
app.get('/me', async (c) => {
  const token = getCookie(c, 'apex_token');
  
  if (!token) {
    return c.json({ user: null }, 401);
  }

  try {
    const secret = process.env.JWT_SECRET!;
    const payload = await verify(token, secret);
    
    // Fetch fresh user data from DB
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
      .limit(1);

    if (!user) {
      return c.json({ user: null }, 401);
    }

    return c.json({ user });
  } catch (error) {
    return c.json({ user: null }, 401);
  }
});

// NEW: Logout
app.post('/logout', (c) => {
  deleteCookie(c, 'apex_token', {
    path: '/',
  });
  return c.json({ success: true });
});

export default app;
