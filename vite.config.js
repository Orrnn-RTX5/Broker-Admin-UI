import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api/v2': {
        target: 'http://localhost:8091',
        changeOrigin: true,
        secure: false,
      },
      '/manager': {
        target: 'http://69.197.178.27',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
