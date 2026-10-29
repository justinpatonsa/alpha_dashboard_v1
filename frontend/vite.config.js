import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, Vite serves the UI and forwards /api to the FastAPI app on :8000.
// For the class demo the API serves the built bundle itself (one port).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5190,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
