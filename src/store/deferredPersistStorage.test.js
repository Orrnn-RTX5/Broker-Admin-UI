import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeferredPersistStorage } from './deferredPersistStorage.js';

test('hot persistence updates are coalesced and serialized after the interaction path', () => {
  const values = new Map();
  const callbacks = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const deferred = createDeferredPersistStorage({
    storage,
    writeDelayMs: 500,
    setTimer: (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    clearTimer: () => {},
    requestIdle: (callback) => callback(),
  });

  deferred.setItem('quotes', { state: { value: 1 }, version: 0 });
  deferred.setItem('quotes', { state: { value: 2 }, version: 0 });

  assert.equal(values.has('quotes'), false, 'localStorage is not written in the click/tick call stack');
  assert.equal(callbacks.length, 1, 'many hot updates share one deferred write');

  callbacks[0]();
  assert.deepEqual(deferred.getItem('quotes'), { state: { value: 2 }, version: 0 });
});
