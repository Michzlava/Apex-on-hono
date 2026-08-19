import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward /api calls to your local Hono worker during dev
      '/api': 'http://localhost:8787'
    }
  }
})
