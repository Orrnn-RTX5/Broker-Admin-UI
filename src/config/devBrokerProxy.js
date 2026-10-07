import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';
import { DEV_PROXY_DIRECT_MANAGER_COOKIE, parseDevProxyTarget, readCookieValue, stripDevProxyCookies } from './devProxy.js';

// Vite otherwise uses agent:false and closes every upstream connection. Keep
// short-lived pools per origin, retiring idle sockets before the next 5s poll.
const agentOptions = { keepAlive: true, maxFreeSockets: 16, timeout: 4000, scheduling: 'lifo' };
const httpAgent = new http.Agent(agentOptions);
const httpsAgent = new https.Agent(agentOptions);

export const createBrokerProxy = (defaultTarget, cookieName, extra = {}) => {
  const targetFor = (req) => parseDevProxyTarget(
    readCookieValue(req.headers.cookie, cookieName), defaultTarget
  );

  return {
    target: defaultTarget,
    changeOrigin: true,
    secure: false,
    ...extra,
    configure(proxy) {
      // Vite's http-proxy does not implement the middleware-only `router` option.
      // Supply the target for each request, without mutating shared proxy options.
      const optionsFor = (req, options) => {
        const target = targetFor(req);
        const directOrigin = parseDevProxyTarget(readCookieValue(req.headers.cookie, DEV_PROXY_DIRECT_MANAGER_COOKIE));
        if (directOrigin === target) {
          req.url = req.url.replace(/^\/manager(?=\/|\?|$)/i, '') || '/';
        }
        return { ...options, target, agent: target.startsWith('https:') ? httpsAgent : httpAgent };
      };
      const web = proxy.web.bind(proxy);
      proxy.web = (req, res, options, ...args) => {
        const resolved = optionsFor(req, options);
        const pathname = req.url.split('?')[0];
        // The legacy manager API also performs writes using GET (for example,
        // GroupDelete and SymbolAdd). Only established read routes may replay.
        const readRoute = /^\/(?:manager\/)?api\/v2\/auth\/me$/i.test(pathname)
          || pathname === '/ws/feed/status'
          || /^\/(?:manager\/)?api\/v1\/manager\/(?:journal|orders|positions|deals|lp-connections)$/i.test(pathname)
          || /^\/(?:manager\/)?[^/]+(?:Get|List|ListExt|Stats|Status)$/.test(pathname);
        const canRetry = ['GET', 'HEAD'].includes(req.method)
          && readRoute
          && !req.headers['transfer-encoding'] && !Number(req.headers['content-length'] || 0);
        let retried = false;
        const onError = (error, ...details) => {
          if (!retried && canRetry && error.code === 'ECONNRESET'
            && !res.headersSent && !res.destroyed && !req.socket.destroyed) {
            retried = true;
            // A reset socket cannot be reused. These known bodyless reads are safe
            // to repeat once; mutations are never replayed by the proxy.
            return web(req, res, { ...resolved, agent: false, buffer: Readable.from([]) }, onError);
          }
          const callback = args.find(arg => typeof arg === 'function');
          if (callback) callback(error, ...details);
          else proxy.emit('error', error, ...details);
        };
        return web(req, res, resolved, onError);
      };
      // Upgrade requests need the same broker selection and direct-manager
      // prefix handling as the HTTP request that issued their one-time ticket.
      const ws = proxy.ws.bind(proxy);
      proxy.ws = (req, socket, head, options, ...args) => ws(req, socket, head, optionsFor(req, options), ...args);

      const prepareRequest = (proxyReq, req, rewriteOrigin) => {
        if (rewriteOrigin) {
          const origin = new URL(targetFor(req)).origin;
          proxyReq.setHeader('origin', origin);
          proxyReq.setHeader('referer', `${origin}/`);
        }
        const cookies = stripDevProxyCookies(proxyReq.getHeader('cookie'));
        if (cookies) proxyReq.setHeader('cookie', cookies);
        else proxyReq.removeHeader('cookie');
      };
      proxy.on('proxyReq', (proxyReq, req) => prepareRequest(proxyReq, req, true));
      // The access stream validates the actual browser Origin. Replacing it
      // with the backend Origin denies a valid, ticket-authorized connection.
      proxy.on('proxyReqWs', (proxyReq, req) => prepareRequest(proxyReq, req, false));
    },
  };
};
