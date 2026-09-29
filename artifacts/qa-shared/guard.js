// QA network guard. Imported FIRST by every admin-panel QA harness so that no
// request can leave the page for the live backend: every service in these
// pages is injected with a stub, and anything that falls through to fetch,
// XHR, WebSocket, EventSource or sendBeacon against an API path (or another
// origin) is refused and recorded in window.__qaBlocked.
const BLOCKED_PATH = /^\/(api|manager|Manager|ext-api|ws|super-admin-api)(\/|$)/;
export const blocked = (window.__qaBlocked = window.__qaBlocked || []);

export const allowedUrl = raw => {
  try {
    const url = new URL(String(raw), location.href);
    if (url.protocol === 'blob:' || url.protocol === 'data:') return true;
    if (url.host !== location.host) return false;
    return !BLOCKED_PATH.test(url.pathname);
  } catch {
    return false;
  }
};

const refuse = (kind, url) => {
  blocked.push({kind, url: String(url)});
  return new TypeError(`QA network guard refused ${kind} ${url}`);
};

if (!window.__qaGuardInstalled) {
  window.__qaGuardInstalled = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    if (!allowedUrl(url)) return Promise.reject(refuse('fetch', url));
    return realFetch(input, init);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__qaUrl = url;
    return open.call(this, method, url, ...rest);
  };
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function patchedSend(body) {
    if (!allowedUrl(this.__qaUrl)) throw refuse('xhr', this.__qaUrl);
    return send.call(this, body);
  };
  const RealWebSocket = window.WebSocket;
  const GuardedWebSocket = function GuardedWebSocket(url, protocols) {
    const http = new URL(new URL(String(url), location.href).href.replace(/^ws/, 'http'));
    // Only the Vite HMR socket (same host, root path) is allowed.
    if (http.host !== location.host || http.pathname !== '/') throw refuse('websocket', url);
    return new RealWebSocket(url, protocols);
  };
  GuardedWebSocket.prototype = RealWebSocket.prototype;
  Object.assign(GuardedWebSocket, {CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3});
  window.WebSocket = GuardedWebSocket;
  window.EventSource = function GuardedEventSource(url) { throw refuse('eventsource', url); };
  if (navigator.sendBeacon) navigator.sendBeacon = url => { refuse('beacon', url); return false; };
  // Destructive confirmations are accepted by the harness explicitly.
  window.confirm = () => true;
}
