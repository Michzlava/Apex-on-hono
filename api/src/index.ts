import { Hono } from 'hono'
import { cors } from 'hono/cors'
import marketRoutes from './routes/market'
import authRoutes from './routes/auth' // <-- ADDED

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://apex.yourdomain.com'],
  credentials: true,
}))

app.get('/', (c) => c.json({ status: 'ok', message: 'Apex API is running!' }))

// Routes
app.route('/api/market', marketRoutes)
app.route('/api/auth', authRoutes) // <-- ADDED

export default app
