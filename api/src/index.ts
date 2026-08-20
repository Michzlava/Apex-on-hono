import { Hono } from 'hono'
import { cors } from 'hono/cors'
import marketRoutes from './routes/market'
import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import newsRoutes from './routes/news'
import depositMethodsRoutes from './routes/deposit-methods'
import depositRoutes from './routes/deposits'
import tradeRoutes from './routes/trade'
import { authMiddleware } from './middleware/auth'
import { createDb } from './db/client'

const app = new Hono()

// 1. CORS — NEVER return undefined when credentials: true is set.
// For same-domain this echoes the request origin. For cross-domain,
// replace with an explicit allow-list: ['https://your-domain.com']
app.use('*', cors({
  origin: (origin, c) => {
    return origin || new URL(c.req.url).origin
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 2. Attach db instance to context on every request
app.use('*', async (c, next) => {
  const dbUrl = (c.env as any).DATABASE_URL
  c.set('db', createDb(dbUrl))
  await next()
})

// 3. Basic root
app.get('/', (c) => c.json({ status: 'ok', message: 'Apex API is running!' }))

// 4. Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'Worker is alive!',
    hasDbUrl: !!(c.env as any).DATABASE_URL,
    hasJwtSecret: !!(c.env as any).JWT_SECRET,
  })
})

// 5. Public API routes
app.route('/api/auth', authRoutes)
app.route('/api/market', marketRoutes)
app.route('/api/news', newsRoutes)

// 6. Protected API routes — middleware FIRST, then mount routes
app.use('/api/admin/*', authMiddleware)
app.route('/api/admin/deposit-methods', depositMethodsRoutes)

app.use('/api/user/*', authMiddleware)
app.route('/api/user/dashboard', dashboardRoutes)
app.route('/api/user/deposits', depositRoutes)

app.use('/api/transaction/*', authMiddleware)
app.route('/api/transaction/trade', tradeRoutes)

// 7. SPA Catch-all (MUST BE LAST)
app.get('*', (c) => {
  return (c.env as any).ASSETS.fetch(c.req.raw)
})

export default app
