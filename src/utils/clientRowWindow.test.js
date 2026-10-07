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

test('trade grids keep every row reachable with their own header and row heights', () => {
  for (const count of [18, 100, 250]) {
    for (const viewportHeight of [180, 400, 700]) {
      for (const scrollTop of [0, 200, 1200, count * 34]) {
        const window = getClientRowWindow(count, scrollTop, viewportHeight, { rowHeight: 34, headerHeight: 34 });
        assert.equal(window.before + (window.end - window.start) * 34 + window.after, count * 34);
        assert(window.end - window.start <= Math.ceil(viewportHeight / 34) + 11);
        assert(window.start >= 0 && window.end <= count);
      }
    }
    assert.equal(getClientRowWindow(count, count * 34, 400, { rowHeight: 34, headerHeight: 34 }).end, count);
  }
});
