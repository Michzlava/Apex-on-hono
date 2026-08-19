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

// 1. Wide-open CORS
app.use('*', cors({
  origin: (origin) => origin,
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 2. Attach db instance to context on every request
app.use('*', (c, next) => {
  const dbUrl = (c.env as any).DATABASE_URL
  c.set('db', createDb(dbUrl))
  return next()
})

// 3. Basic root
app.get('/', (c) => c.json({ status: 'ok', message: 'Apex API is running!' }))

// 4. Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'Worker is alive!',
    hasDbUrl: !!(process.env.DATABASE_URL || (c.env as any).DATABASE_URL),
    hasJwtSecret: !!(process.env.JWT_SECRET || (c.env as any).JWT_SECRET),
    message: 'If these are false, add them in Cloudflare Dashboard -> Settings -> Variables'
  })
})

// 5. Public API routes
app.route('/api/auth', authRoutes)
app.route('/api/market', marketRoutes)
app.route('/api/news', newsRoutes)
app.route('/api/admin/deposit-methods', depositMethodsRoutes)

// 6. Protected API routes
app.use('/api/user/*', authMiddleware)
app.use('/api/admin/*', authMiddleware)
app.use('/api/transaction/*', authMiddleware)
app.route('/api/user/dashboard', dashboardRoutes)
app.route('/api/user/deposits', depositRoutes)
app.route('/api/transaction/trade', tradeRoutes)

// 7. SPA Catch-all (MUST BE LAST)
app.get('*', (c) => {
  return (c.env as any).ASSETS.fetch(c.req.raw)
})

export default app
