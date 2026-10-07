import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSharedFeedLease } from './sharedFeedLease.js';

function fixture() {
  const calls = [];
  const timers = new Map();
  let id = 0;
  const acquire = createSharedFeedLease({
    start: () => calls.push('start'), stop: () => calls.push('stop'),
    setTimer: fn => { timers.set(++id, fn); return id; }, clearTimer: id => timers.delete(id),
  });
  return { acquire, calls, flush: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } };
}

test('development effect replay shares one socket and real unmount closes it', () => {
  const f = fixture();
  f.acquire('broker:9001')();
  const release = f.acquire('broker:9001');
  f.flush();
  assert.deepEqual(f.calls, ['start']);
  release();
  release();
  f.flush();
  assert.deepEqual(f.calls, ['start', 'stop']);
});

test('account or broker switch stops the old feed before opening the new one', () => {
  const f = fixture();
  const oldRelease = f.acquire('broker-a:9001');
  oldRelease();
  const release = f.acquire('broker-b:9001');
  oldRelease();
  f.flush();
  assert.deepEqual(f.calls, ['start', 'stop', 'start']);
  release();
  f.flush();
  assert.deepEqual(f.calls, ['start', 'stop', 'start', 'stop']);
});

test('one consumer unmount cannot close a feed another consumer is using', () => {
  const f = fixture();
  const one = f.acquire('broker:9001');
  const two = f.acquire('broker:9001');
  one();
  f.flush();
  assert.deepEqual(f.calls, ['start']);
  two();
  f.flush();
  assert.deepEqual(f.calls, ['start', 'stop']);
});
