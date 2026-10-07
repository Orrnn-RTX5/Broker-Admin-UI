export const GATEWAY_CONNECTIONS_FRESH_MS = 5_000;
export const GATEWAY_CONNECTIONS_SNAPSHOT_MS = 60_000;
const canceled = () => Object.assign(new Error('Connection read canceled'), { name: 'AbortError', code: 'ERR_CANCELED' });

// Read-only, memory-only handoff from navigation preparation to Connections.
// Saved configurations and runtime states never cross an authorization scope.
export const createGatewayConnectionsCache = ({ fetchConnections, now = Date.now }) => {
  let owner = '', generation = 0, snapshot = null, pending = null, failure = null;
  const clear = () => {
    generation++; pending?.controller.abort();
    owner = ''; snapshot = null; pending = null; failure = null;
  };
  const peek = scope => owner === scope && snapshot && now() - snapshot.fetchedAt < GATEWAY_CONNECTIONS_SNAPSHOT_MS ? snapshot : null;
  const read = (scope, { force = false } = {}) => {
    if (!scope) return Promise.reject(canceled());
    if (owner !== scope) { clear(); owner = scope; }
    if (pending) return pending.promise;
    if (!force && snapshot && now() - snapshot.fetchedAt < GATEWAY_CONNECTIONS_FRESH_MS) return Promise.resolve(snapshot.data);
    if (!force && failure && now() - failure.at < GATEWAY_CONNECTIONS_FRESH_MS) return Promise.reject(failure.error);
    const request = { controller: new AbortController(), generation, promise: null };
    pending = request;
    request.promise = (async () => {
      try {
        const data = await fetchConnections({ signal: request.controller.signal });
        if (owner !== scope || generation !== request.generation || request.controller.signal.aborted) throw canceled();
        if (!Array.isArray(data?.connections) || data.connections.some(record => !record?.config || typeof record.config.id !== 'string')) {
          throw new Error('Invalid saved connections response.');
        }
        snapshot = { data, fetchedAt: now() }; failure = null;
        return data;
      } catch (error) {
        if (owner === scope && generation === request.generation && !request.controller.signal.aborted) {
          failure = { error, at: now() };
          if ([401, 403].includes(Number(error?.status ?? error?.response?.status))) snapshot = null;
        }
        throw error;
      } finally { if (pending === request) pending = null; }
    })();
    request.promise.catch(() => {});
    return request.promise;
  };
  return { read, peek, clear, invalidate: scope => { if (owner === scope) clear(); } };
};
