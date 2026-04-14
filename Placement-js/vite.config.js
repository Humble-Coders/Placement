import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Serve index.html for all routes in dev (SPA mode)
  appType: 'spa',
})
