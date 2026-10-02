import assert from 'node:assert/strict';
import test from 'node:test';
import { isAssetLoadError, registerAssetLoadRecovery } from './assetLoadRecovery.js';

const makeBrowser = (storage = new Map()) => {
  const listeners = new Map();
  const browser = {
    reloads: 0,
    location: { protocol: 'https:', reload: () => { browser.reloads += 1; } },
    navigator: { onLine: true },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name, listener) => {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
    fail: (payload) => listeners.get('vite:preloadError')?.({ payload }),
  };
  return browser;
};

const cssFailure = () => new Error('Unable to preload CSS for https://admin.example/assets/AuthenticatedApp-old.css');

test('reloads a failed CSS chunk once and prevents loops across page reloads', () => {
  const storage = new Map();
  const browser = makeBrowser(storage);
  registerAssetLoadRecovery(browser, () => 100_000);
  browser.fail(cssFailure());
  browser.fail(cssFailure());
  assert.equal(browser.reloads, 1);

  const reloaded = makeBrowser(storage);
  registerAssetLoadRecovery(reloaded, () => 101_000);
  reloaded.fail(cssFailure());
  assert.equal(reloaded.reloads, 0);

  const later = makeBrowser(storage);
  registerAssetLoadRecovery(later, () => 161_000);
  later.fail(cssFailure());
  assert.equal(later.reloads, 1);
});

test('recognizes browser chunk download failures but leaves application errors alone', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://admin.example/assets/old.js',
    'error loading dynamically imported module: https://admin.example/assets/old.js',
    'Importing a module script failed.',
  ]) {
    const browser = makeBrowser();
    registerAssetLoadRecovery(browser, () => 100_000);
    browser.fail(new TypeError(message));
    assert.equal(browser.reloads, 1, message);
  }

  const browser = makeBrowser();
  registerAssetLoadRecovery(browser);
  browser.fail(new Error('Cannot read properties of undefined'));
  assert.equal(browser.reloads, 0);
  assert.equal(isAssetLoadError(null), false);
});

test('keeps the error screen available offline, on desktop, and when storage is blocked', () => {
  const offline = makeBrowser();
  offline.navigator.onLine = false;
  const desktop = makeBrowser();
  desktop.location.protocol = 'file:';
  const blocked = makeBrowser();
  blocked.sessionStorage.setItem = () => { throw new Error('Storage is disabled'); };
  for (const browser of [offline, desktop, blocked]) {
    registerAssetLoadRecovery(browser);
    browser.fail(cssFailure());
    assert.equal(browser.reloads, 0);
  }
});

test('unregisters the handler when disposed', () => {
  const browser = makeBrowser();
  const dispose = registerAssetLoadRecovery(browser);
  dispose();
  browser.fail(cssFailure());
  assert.equal(browser.reloads, 0);
});
