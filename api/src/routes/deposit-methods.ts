  import { Hono } from 'hono';
import { depositMethods } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const app = new Hono();

function isAdmin(c: any) {
  return c.get('userRole') === 'ADMIN'
}

// GET /api/admin/deposit-methods — active methods for deposit sheet
app.get('/', async (c) => {
  const db = c.get('db');

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

// ── Manage endpoints (admin-only) ───────────────────────────────────────────

// GET /api/admin/deposit-methods/manage — all methods
app.get('/manage', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');

  const methods = await db
    .select()
    .from(depositMethods)
    .orderBy(asc(depositMethods.sortOrder));

  return c.json(methods);
});

// POST /api/admin/deposit-methods/manage — create
app.post('/manage', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');
  const body = await c.req.json();

  if (!body.label || !body.address) {
    return c.json({ error: 'label and address are required' }, 400);
  }

  const [method] = await db.insert(depositMethods).values({
    id: crypto.randomUUID(),
    label: body.label,
    icon: body.icon ?? '💳',
    address: body.address,
    network: body.network ?? null,
    note: body.note ?? null,
    isActive: body.isActive ?? true,
    sortOrder: body.sortOrder ?? 0,
  }).returning();

  return c.json(method, 201);
});

// PATCH /api/admin/deposit-methods/manage — update
app.patch('/manage', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');
  const body = await c.req.json();
  const { id, ...data } = body;

  if (!id) return c.json({ error: 'id is required' }, 400);

  const [method] = await db
    .update(depositMethods)
    .set({
      ...(data.label !== undefined && { label: data.label }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.network !== undefined && { network: data.network || null }),
      ...(data.note !== undefined && { note: data.note || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedAt: new Date(),
    })
    .where(eq(depositMethods.id, id))
    .returning();

  return c.json(method);
});

// DELETE /api/admin/deposit-methods/manage — delete
app.delete('/manage', async (c) => {
  if (!isAdmin(c)) return c.json({ error: 'Forbidden' }, 403);
  const db = c.get('db');
  const id = c.req.query('id');

  if (!id) return c.json({ error: 'id is required' }, 400);

  await db
    .delete(depositMethods)
    .where(eq(depositMethods.id, id));

  return c.json({ success: true });
});

export default app;
