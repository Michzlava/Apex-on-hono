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

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://apex.yourdomain.com'],
  credentials: true,
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

export default app
// Serve the React SPA for all non-API GET routes
app.get('*', (c) => {
  return (c.env as any).ASSETS.fetch(c.req.raw)
})

export default app
