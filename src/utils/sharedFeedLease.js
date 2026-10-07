// Defer the final release by one task so React's development effect replay can
// reuse a connection. A different authenticated scope always stops it first.
export function createSharedFeedLease({ start, stop, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let active = null;
  return scope => {
    if (active && active.scope !== scope) {
      clearTimer(active.timer);
      stop();
      active = null;
    }
    if (!active) {
      active = { scope, consumers: 0, timer: null };
      start();
    }
    const lease = active;
    clearTimer(lease.timer);
    lease.timer = null;
    lease.consumers++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (active !== lease || --lease.consumers > 0) return;
      lease.timer = setTimer(() => {
        if (active !== lease || lease.consumers) return;
        active = null;
        stop();
      }, 0);
    };
  };
}
