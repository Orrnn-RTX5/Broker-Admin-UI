const RECOVERY_KEY = 'rtx5:asset-load-recovery';
const RECOVERY_COOLDOWN_MS = 60_000;

export const isAssetLoadError = (error) => /Unable to preload CSS for|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
  String(error?.message || error || ''),
);

// A tab left open during deployment can reference chunks from the old build.
// Reload the document once to get current asset URLs; persist the guard across
// navigation so a missing asset or interrupted connection cannot cause a loop.
export const registerAssetLoadRecovery = (browser = window, now = Date.now) => {
  let reloadStarted = false;
  const recover = (event) => {
    if (reloadStarted || !isAssetLoadError(event.payload)) return;
    if (!['http:', 'https:'].includes(browser.location.protocol)) return;
    if (browser.navigator?.onLine === false) return;

    try {
      const timestamp = now();
      const previousAttempt = Number(browser.sessionStorage.getItem(RECOVERY_KEY));
      if (previousAttempt > 0 && timestamp - previousAttempt < RECOVERY_COOLDOWN_MS) return;
      browser.sessionStorage.setItem(RECOVERY_KEY, String(timestamp));
    } catch {
      // Without persistent storage there is no safe way to bound auto-reloads.
      return;
    }

    reloadStarted = true;
    browser.location.reload();
  };

  browser.addEventListener('vite:preloadError', recover);
  return () => browser.removeEventListener('vite:preloadError', recover);
};
