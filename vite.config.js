import { createLogger, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  DEV_PROXY_BACKEND_COOKIE,
  DEV_PROXY_EXT_COOKIE,
} from './src/config/devProxy.js'
import { createBrokerProxy } from './src/config/devBrokerProxy.js'

const ignoredWsProxyErrorCodes = new Set(['ECONNABORTED', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT'])
const viteLogger = createLogger()
const defaultLoggerError = viteLogger.error

viteLogger.error = (message, options) => {
  const isIgnoredWsProxyError = (
    typeof message === 'string'
    && ignoredWsProxyErrorCodes.has(options?.error?.code)
    && (message.includes('ws proxy error:') || message.includes('ws proxy socket error:'))
  )

  if (isIgnoredWsProxyError) return
  defaultLoggerError.call(viteLogger, message, options)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiHost    = env.VITE_API_HOST || env.VITE_API_URL || env.API_HOST || env.API_URL || 'https://backend.orrnn.com'
  const apiHostExt = env.VITE_API_HOST_EXT || env.VITE_API_EXT_URL || env.API_HOST_EXT || env.API_EXT_URL || 'http://backend.orrnn.com:8091'
  const superAdminHost = env.VITE_SUPER_ADMIN_API_HOST || env.SUPER_ADMIN_API_HOST || 'https://fxtrustsuperbackned.orrnn.com'
  const wsFeedHost = env.VITE_FEED_WS_URL || env.VITE_WS_HOST || env.WS_HOST || 'wss://nexa.orrnn.com/ws/feed'
  const wsFeedUrl = new URL(wsFeedHost.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:'))
  const wsTarget = wsFeedUrl.origin

  return {
    customLogger: viteLogger,
    plugins: [
      react(),
      tailwindcss(),
    ],
    base: './',
    server: {
      proxy: {
        // Market Feed WebSocket and HTTP Status
        '/ws/feed/status': {
          target: wsTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws/feed': {
          target: wsTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewriteWsOrigin: true,
        },
        '/ws': {
          target: wsTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewriteWsOrigin: true,
        },

        // Gateway LP API
        '/api/v1': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        '/api/v2': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        '/manager': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        '/Manager': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        // Platform Super Admin API uses an independent login/session.
        '/super-admin-api': {
          target: superAdminHost,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/super-admin-api/, ''),
        },
        // Port 8091 APIs: MarketDepth, SessionOverride, SpreadSchedule
        '/ext-api': createBrokerProxy(apiHostExt, DEV_PROXY_EXT_COOKIE, {
          rewrite: (path) => path.replace(/^\/ext-api/, ''),
        }),
      }
    }
  }
})
