import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Same-origin API in dev, so auth cookies stay first-party (ADR 0003).
  server: { proxy: { '/api': 'http://127.0.0.1:3000' } },
})
