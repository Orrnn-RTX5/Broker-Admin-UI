const DEFAULT_WRITE_DELAY_MS = 500;
const DEFAULT_IDLE_TIMEOUT_MS = 1000;

const getRequestIdleCallback = () => {
  try {
    return typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback.bind(window)
      : null;
  } catch {
    return null;
  }
};

/**
 * Zustand-compatible JSON storage that coalesces hot state updates and performs
 * serialization outside the interaction path. Reads stay synchronous so cached
 * state is available during the first render after a reload.
 */
export const createDeferredPersistStorage = ({
  storage,
  writeDelayMs = DEFAULT_WRITE_DELAY_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  requestIdle = getRequestIdleCallback(),
} = {}) => {
  if (!storage) return undefined;

  const pending = new Map();
  let timerId = null;
  let idlePending = false;

  const flush = () => {
    timerId = null;
    idlePending = false;
    for (const [name, value] of pending) {
      storage.setItem(name, JSON.stringify(value));
    }
    pending.clear();
  };

  const scheduleFlush = () => {
    if (timerId !== null || idlePending) return;
    timerId = setTimer(() => {
      timerId = null;
      if (requestIdle) {
        idlePending = true;
        requestIdle(flush, { timeout: idleTimeoutMs });
        return;
      }
      flush();
    }, writeDelayMs);
  };

  return {
    getItem: (name) => {
      const value = storage.getItem(name);
      return value === null ? null : JSON.parse(value);
    },
    setItem: (name, value) => {
      pending.set(name, value);
      scheduleFlush();
    },
    removeItem: (name) => {
      pending.delete(name);
      storage.removeItem(name);
    },
    flush,
    cancelPending: () => {
      if (timerId !== null) clearTimer(timerId);
      timerId = null;
      idlePending = false;
      pending.clear();
    },
  };
};

export const createBrowserDeferredPersistStorage = () => {
  try {
    return typeof window !== 'undefined'
      ? createDeferredPersistStorage({ storage: window.localStorage })
      : undefined;
  } catch {
    return undefined;
  }
};
