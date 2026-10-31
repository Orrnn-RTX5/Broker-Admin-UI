import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '80', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.resolve(process.env.DIST_DIR || path.join(__dirname, 'dist'));

const EXT_API_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

export const resolveExtApiUpstream = (env = process.env) => {
  const raw = String(
    env.API_HOST_EXT ||
      env.VITE_API_HOST_EXT ||
      env.API_HOST ||
      env.VITE_API_HOST ||
      ''
  )
    .trim()
    .replace(/\/+$/, '');
  if (!raw) return null;

  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : `${/:8091(?:\/|$)/.test(raw) ? 'http' : 'https'}://${raw}`;
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
};

export const isExtApiRequest = (reqUrl = '') =>
  reqUrl === '/ext-api' || reqUrl.startsWith('/ext-api/') || reqUrl.startsWith('/ext-api?');

export const rewriteExtApiPath = (reqUrl = '', basePathname = '/') => {
  const stripped = String(reqUrl || '').slice('/ext-api'.length);
  const suffix = (!stripped
    ? '/'
    : stripped.startsWith('/')
      ? stripped
      : `/${stripped}`).replace(/^\/+/, '/');
  const basePath = String(basePathname || '').replace(/\/+$/, '');
  return `${basePath}${suffix}`;
};

const proxyExtApiRequest = (req, res) => {
  if (!EXT_API_METHODS.has(req.method || '')) {
    res.writeHead(405, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
    });
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  const upstream = resolveExtApiUpstream(process.env);
  if (!upstream) {
    res.writeHead(503, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.end(
      req.method === 'HEAD'
        ? undefined
        : JSON.stringify({
            error: 'Service Unavailable',
            message: 'Upstream ext-api host is not configured (set API_HOST_EXT or API_HOST).'
          })
    );
  }

  const proxyHeaders = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower) || lower === 'host') continue;
    proxyHeaders[key] = value;
  }
  proxyHeaders.host = upstream.host;

  const transport = upstream.protocol === 'https:' ? https : http;
  const targetPath = rewriteExtApiPath(req.url, upstream.pathname);

  const proxyReq = transport.request(
    {
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: targetPath,
      headers: proxyHeaders
    },
    (proxyRes) => {
      const responseHeaders = {};
      for (const [key, value] of Object.entries(proxyRes.headers || {})) {
        if (value === undefined) continue;
        if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
        responseHeaders[key] = value;
      }
      res.writeHead(proxyRes.statusCode || 502, responseHeaders);
      if (req.method === 'HEAD') {
        proxyRes.resume();
        res.end();
        return;
      }
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(
        req.method === 'HEAD'
          ? undefined
          : JSON.stringify({ error: 'Bad Gateway', message: err.message })
      );
    } else if (!res.writableEnded) {
      res.destroy();
    }
  });

  req.on('error', () => proxyReq.destroy());
  res.on('close', () => {
    if (!res.writableEnded) {
      proxyReq.destroy();
    }
  });

  req.pipe(proxyReq);
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  if (isExtApiRequest(req.url || '')) {
    return proxyExtApiRequest(req, res);
  }

  // Only handle GET and HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed');
  }

  // Health check endpoint
  if (req.url === '/healthz' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  // Parse path without query strings
  const urlPath = req.url.split('?')[0];
  let decodedPath = '';
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }

  // Resolve target file path
  let safePath = path.normalize(path.join(DIST_DIR, decodedPath));

  // Guard against directory traversal
  if (!safePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  fs.stat(safePath, (err, stats) => {
    // If path is a directory, look for index.html inside it
    if (!err && stats.isDirectory()) {
      safePath = path.join(safePath, 'index.html');
    }

    // Only document navigations may use the SPA fallback. Returning index.html
    // for a missing build asset makes a stale CSS/JS URL look successful while
    // the browser rejects its content type and fails the lazy import.
    if (err || !fs.existsSync(safePath)) {
      const requestedExtension = path.extname(decodedPath).toLowerCase();
      const isAssetRequest = decodedPath === '/assets' || decodedPath.startsWith('/assets/') ||
        (requestedExtension !== '' && requestedExtension !== '.html');
      const acceptsHtml = (req.headers.accept || '').includes('text/html');
      if (isAssetRequest || !acceptsHtml) {
        res.writeHead(404, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        return res.end('Not Found');
      }
      safePath = path.join(DIST_DIR, 'index.html');
    }

    // Check if index.html itself exists
    if (!fs.existsSync(safePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('App not built or dist directory missing');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff'
    };

    // Cache headers
    if (safePath.endsWith('runtime-config.js')) {
      // Runtime configuration must never be cached by browser
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    } else if (ext === '.html') {
      // An old document can reference assets removed by a newer deployment.
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    } else if (decodedPath.startsWith('/assets/')) {
      // Hashed assets can be safely cached forever
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      return res.end();
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(safePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end('Server Error');
    });
    stream.pipe(res);
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  server.listen(PORT, HOST, () => {
    console.log(`[Broker-Admin-UI] React frontend server listening on http://${HOST}:${server.address().port}`);
    console.log(`[Broker-Admin-UI] Serving static build from: ${DIST_DIR}`);
  });
}

// Graceful shutdown
const shutdown = () => {
  console.log('[Broker-Admin-UI] Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
