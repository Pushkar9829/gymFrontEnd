import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Local dev: proxy API calls so cookies are same-origin.
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://localhost:5020' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
})
