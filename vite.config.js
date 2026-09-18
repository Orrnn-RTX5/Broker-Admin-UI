import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  DEV_PROXY_BACKEND_COOKIE,
  DEV_PROXY_EXT_COOKIE,
} from './src/config/devProxy.js'
import { createBrokerProxy } from './src/config/devBrokerProxy.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiHost    = env.VITE_API_HOST || env.VITE_API_URL || env.API_HOST || env.API_URL || 'https://backend.orrnn.com'
  const apiHostExt = env.VITE_API_HOST_EXT || env.VITE_API_EXT_URL || env.API_HOST_EXT || env.API_EXT_URL || 'http://backend.orrnn.com:8091'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    base: './',
    server: {
      proxy: {
        // Gateway LP API
        '/api/v1': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        '/api/v2': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        '/manager': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        '/Manager': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        // Port 8091 APIs: MarketDepth, SessionOverride, SpreadSchedule
        '/ext-api': createBrokerProxy(apiHostExt, DEV_PROXY_EXT_COOKIE, {
          rewrite: (path) => path.replace(/^\/ext-api/, ''),
        }),
      }
    }
  }
})
