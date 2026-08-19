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

// Dynamic CORS - accepts localhost, workers.dev, and your custom domain
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return origin
    // Allow localhost dev
    if (origin.startsWith('http://localhost')) return origin
    // Allow any workers.dev deployment
    if (origin.endsWith('.workers.dev')) return origin
    // Allow your custom domain (update with your actual domain)
    if (origin.includes('apex') || origin.includes('michelle-zavala')) return origin
    return origin
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.get('/', (c) => c.json({ status: 'ok', message: 'Apex API is running!' }))

// Public routes
app.route('/api/auth', authRoutes)
app.route('/api/market', marketRoutes)
app.route('/api/news', newsRoutes)

// Protected routes
app.use('/api/user/*', authMiddleware)
app.use('/api/admin/*', authMiddleware)

app.route('/api/user/dashboard', dashboardRoutes)
app.route('/api/user/deposits', depositRoutes)
app.route('/api/admin/deposit-methods', depositMethodsRoutes)

// Serve the React SPA for all non-API GET routes
app.get('*', (c) => {
  return (c.env as any).ASSETS.fetch(c.req.raw)
})

export default app
