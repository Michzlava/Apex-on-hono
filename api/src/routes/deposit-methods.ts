import { Hono } from 'hono';
import { db } from '../db/client';
import { depositMethods } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const app = new Hono();

// GET /api/admin/deposit-methods - Fetch active deposit methods
app.get('/', async (c) => {
  try {
    const methods = await db
      .select()
      .from(depositMethods)
      .where(eq(depositMethods.isActive, true))
      .orderBy(asc(depositMethods.sortOrder));

    return c.json(methods);
  } catch (error) {
    console.error('Deposit methods fetch error:', error);
    return c.json([]);
  }
});

export default app;
