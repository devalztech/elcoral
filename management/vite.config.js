import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The management app is its own deployment on its own host. It runs on
// 5174 in dev so it can sit next to the member frontend (5173) without a
// port clash, and proxies /api to the same backend the frontend uses —
// there is only ever one API and one database.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
