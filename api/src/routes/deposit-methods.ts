import { Hono } from 'hono';
import { depositMethods } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const app = new Hono();

// GET /api/admin/deposit-methods — active methods for users
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

// GET /api/admin/deposit-methods/manage — all methods for admin
app.get('/manage', async (c) => {
  const db = c.get('db');

  try {
    const methods = await db
      .select()
      .from(depositMethods)
      .orderBy(asc(depositMethods.sortOrder));

    return c.json(methods);
  } catch (error) {
    console.error('Deposit methods manage fetch error:', error);
    return c.json([]);
  }
});

// POST /api/admin/deposit-methods/manage — create
app.post('/manage', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  try {
    await db.insert(depositMethods).values({
      id: crypto.randomUUID(),
      label: body.label,
      icon: body.icon,
      address: body.address,
      network: body.network || null,
      note: body.note || null,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Create deposit method error:', error);
    return c.json({ error: error.message || 'Failed to create' }, 500);
  }
});

// PATCH /api/admin/deposit-methods/manage — update
app.patch('/manage', async (c) => {
  const db = c.get('db');
  const body = await c.req.json();

  if (!body.id) {
    return c.json({ error: 'ID required' }, 400);
  }

  try {
    await db
      .update(depositMethods)
      .set({
        ...(body.label !== undefined && { label: body.label }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.network !== undefined && { network: body.network || null }),
        ...(body.note !== undefined && { note: body.note || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        updatedAt: new Date(),
      })
      .where(eq(depositMethods.id, body.id));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Update deposit method error:', error);
    return c.json({ error: error.message || 'Failed to update' }, 500);
  }
});

// DELETE /api/admin/deposit-methods/manage — delete
app.delete('/manage', async (c) => {
  const db = c.get('db');
  const id = c.req.query('id');

  if (!id) {
    return c.json({ error: 'ID required' }, 400);
  }

  try {
    await db
      .delete(depositMethods)
      .where(eq(depositMethods.id, id));

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete deposit method error:', error);
    return c.json({ error: error.message || 'Failed to delete' }, 500);
  }
});

export default app;
