import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Allow your frontend to talk to this API
app.use('*', cors())

// Health check route
app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Apex API is running on Cloudflare Workers!' 
  })
})

export default app
