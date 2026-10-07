import { createLogger, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  DEV_PROXY_BACKEND_COOKIE,
  DEV_PROXY_EXT_COOKIE,
  DEV_PROXY_FEED_COOKIE,
  isLocalWebHostname,
} from './src/config/devProxy.js'
import { createBrokerProxy } from './src/config/devBrokerProxy.js'

const isLocalSameOriginWsRequest = (req) => {
  const origin = req.headers.origin
  const host = req.headers.host
  if (typeof origin !== 'string' || typeof host !== 'string') return false

  try {
    const originUrl = new URL(origin)
    const appUrl = new URL(`${req.socket.encrypted ? 'https' : 'http'}://${host}`)
    return isLocalWebHostname(originUrl.hostname)
      && isLocalWebHostname(appUrl.hostname)
      && originUrl.href === `${originUrl.origin}/`
      && originUrl.origin === appUrl.origin
  } catch {
    return false
  }
}

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
  const useFeedDevProxy = mode === 'development' && String(env.VITE_FEED_USE_DEV_PROXY || '').toLowerCase() === 'true'
  const configuredFeedProxyOrigin = useFeedDevProxy ? String(env.VITE_FEED_WS_PROXY_ORIGIN || '').trim() : ''
  let feedProxyOrigin = ''
  if (configuredFeedProxyOrigin) {
    const parsedOrigin = new URL(configuredFeedProxyOrigin)
    if (!['http:', 'https:'].includes(parsedOrigin.protocol)
      || !isLocalWebHostname(parsedOrigin.hostname)
      || parsedOrigin.href !== `${parsedOrigin.origin}/`) {
      throw new Error('VITE_FEED_WS_PROXY_ORIGIN must be a local HTTP origin without a path')
    }
    feedProxyOrigin = parsedOrigin.origin
  }

  return {
    customLogger: viteLogger,
    plugins: [
      react(),
      tailwindcss(),
    ],
    // Web deep links resolve assets from the origin; Electron needs file URLs.
    base: mode === 'electron' ? './' : '/',
    build: {
      rolldownOptions: {
        output: {
          // Consolidate shared imports so opening the workspace does not issue
          // a separate request for every icon and small utility. Views retain
          // their dynamic imports and download only when selected.
          codeSplitting: {
            groups: [
              { name: 'react-vendor', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/, priority: 30 },
              { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 20 },
              { name: 'ui-vendor', test: /node_modules[\\/](?:@radix-ui|@floating-ui|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 15 },
              { name: 'data-vendor', test: /node_modules[\\/](?:axios|zustand)[\\/]/, priority: 10 },
              {
                name: 'workspace-shared',
                test: /[\\/]src[\\/](?:config|lib|services|store|utils|hooks|data)[\\/]/,
                minShareCount: 2,
                priority: 5,
              },
            ],
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        // Market Feed WebSocket and HTTP Status
        '/ws/feed/status': createBrokerProxy(wsTarget, DEV_PROXY_FEED_COOKIE),
        '/ws/feed': {
          target: wsTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewriteWsOrigin: !feedProxyOrigin,
          ...(feedProxyOrigin ? {
            bypass: (req) => {
              if (String(req.headers.upgrade || '').toLowerCase() !== 'websocket') return
              if (!isLocalSameOriginWsRequest(req)) return false
            },
            configure: (proxy) => {
              proxy.on('proxyReqWs', (proxyReq) => {
                proxyReq.setHeader('Origin', feedProxyOrigin)
              })
            },
          } : {}),
        },
        '/ws': {
          target: wsTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewriteWsOrigin: false,
        },

        // Gateway LP API
        '/api/v1': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        '/api/v2': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE),
        '/manager': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE, { ws: true }),
        '/Manager': createBrokerProxy(apiHost, DEV_PROXY_BACKEND_COOKIE, { ws: true }),
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
