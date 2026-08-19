import { Hono } from 'hono'
import { cors } from 'hono/cors'
import marketRoutes from './routes/market'
import authRoutes from './routes/auth'
import dashboardRoutes from './routes/dashboard'
import newsRoutes from './routes/news'
import depositMethodsRoutes from './routes/deposit-methods'
import depositRoutes from './routes/deposits'
import { authMiddleware } from './middleware/auth'

const app = new Hono()

// 1. Wide-open CORS to completely rule it out during mobile testing
app.use('*', cors({
  origin: (origin) => origin, // Reflects the exact origin back (safe for credentials)
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// 2. Basic root
app.get('/', (c) => c.json({ status: 'ok', message: 'Apex API is running!' }))

// 3. HEALTH CHECK (Must be above the catch-all!)
app.get('/api/health', (c) => {
  return c.json({
    status: 'Worker is alive!',
    hasDbUrl: !!(process.env.DATABASE_URL || (c.env as any).DATABASE_URL),
    hasJwtSecret: !!(process.env.JWT_SECRET || (c.env as any).JWT_SECRET),
    message: 'If these are false, add them in Cloudflare Dashboard -> Settings -> Variables'
  })
})

// 4. Public API routes
app.route('/api/auth', authRoutes)
app.route('/api/market', marketRoutes)
app.route('/api/news', newsRoutes)
app.route('/api/admin/deposit-methods', depositMethodsRoutes)

// 5. Protected API routes
app.use('/api/user/*', authMiddleware)
app.use('/api/admin/*', authMiddleware)
app.route('/api/user/dashboard', dashboardRoutes)
app.route('/api/user/deposits', depositRoutes)

// 6. SPA Catch-all (MUST BE THE VERY LAST ROUTE)
app.get('*', (c) => {
  return (c.env as any).ASSETS.fetch(c.req.raw)
})

export default app
