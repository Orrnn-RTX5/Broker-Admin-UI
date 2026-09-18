import { DEV_PROXY_DIRECT_MANAGER_COOKIE, parseDevProxyTarget, readCookieValue, stripDevProxyCookies } from './devProxy.js';

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
      const web = proxy.web.bind(proxy);
      proxy.web = (req, res, options, ...args) => {
        const target = targetFor(req);
        const directOrigin = parseDevProxyTarget(readCookieValue(req.headers.cookie, DEV_PROXY_DIRECT_MANAGER_COOKIE));
        if (directOrigin === target) {
          req.url = req.url.replace(/^\/manager(?=\/|\?|$)/i, '') || '/';
        }
        return web(req, res, { ...options, target }, ...args);
      };

      proxy.on('proxyReq', (proxyReq, req) => {
        const origin = new URL(targetFor(req)).origin;
        proxyReq.setHeader('origin', origin);
        proxyReq.setHeader('referer', `${origin}/`);
        const cookies = stripDevProxyCookies(proxyReq.getHeader('cookie'));
        if (cookies) proxyReq.setHeader('cookie', cookies);
        else proxyReq.removeHeader('cookie');
      });
    },
  };
};
