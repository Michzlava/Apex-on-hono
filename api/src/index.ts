import { Hono } from 'hono'
import { cors } from 'hono/cors'
import marketRoutes from './routes/market'

const app = new Hono()

// Global CORS for your Vite dev server and production domain
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://apex.yourdomain.com'],
  credentials: true,
}))

// Health check
app.get('/', (c) => c.json({ status: 'ok', message: 'Apex API is running!' }))

// Routes
app.route('/api/market', marketRoutes)

export default app
