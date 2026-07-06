import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/appointments': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/api/billing': {
        target: 'http://127.0.0.1:6000',
        changeOrigin: true
      }
    }
  }
})
