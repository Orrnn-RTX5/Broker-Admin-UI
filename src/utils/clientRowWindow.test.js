import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_ROW_HEIGHT, getClientRowWindow } from './clientRowWindow.js';

test('client windows retain the full scroll height and cover visible rows at every scroll position', () => {
  const count = 250;
  for (const viewport of [200, 500, 1000]) {
    for (const scrollTop of [0, 150, 1000, count * CLIENT_ROW_HEIGHT]) {
      const range = getClientRowWindow(count, scrollTop, viewport);
      assert(range.start >= 0 && range.start < range.end && range.end <= count);
      assert.equal(range.before + (range.end - range.start) * CLIENT_ROW_HEIGHT + range.after, count * CLIENT_ROW_HEIGHT);
      assert(range.end - range.start <= Math.ceil(viewport / CLIENT_ROW_HEIGHT) + 11);
    }
  }
  assert.equal(getClientRowWindow(count, 0, 500).start, 0);
  assert.equal(getClientRowWindow(count, count * CLIENT_ROW_HEIGHT, 500).end, count);
});

test('empty and short client pages do not add blank rows or hide records', () => {
  assert.deepEqual(getClientRowWindow(0), { start: 0, end: 0, before: 0, after: 0 });
  assert.deepEqual(getClientRowWindow(3, 10000, 500), { start: 0, end: 3, before: 0, after: 0 });
});
