// Run with: node --test src/utils/dialogEscape.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NESTED_POPUP_SELECTOR,
  isNestedPopupOpen,
  shouldParentHandleEscape,
} from './dialogEscape.js';

const fakeRoot = (nested) => ({
  querySelector: (selector) => {
    assert.equal(selector, NESTED_POPUP_SELECTOR);
    return nested ? { marker: true } : null;
  },
});

const fakeEvent = (key, root) => ({
  key,
  target: root ? { ownerDocument: root } : null,
  currentTarget: null,
});

test('no nested popup: helpers report closed / parent handles Escape', () => {
  assert.equal(isNestedPopupOpen(fakeRoot(false)), false);
  assert.equal(isNestedPopupOpen(null), false);
  assert.equal(isNestedPopupOpen(undefined), false);
  assert.equal(shouldParentHandleEscape(fakeEvent('Escape', fakeRoot(false))), true);
  assert.equal(shouldParentHandleEscape(fakeEvent('Escape', null)), true);
});

test('nested popup open: parent Escape handler stands down', () => {
  assert.equal(isNestedPopupOpen(fakeRoot(true)), true);
  assert.equal(shouldParentHandleEscape(fakeEvent('Escape', fakeRoot(true))), false);
});

test('non-Escape and malformed events never trigger the parent handler', () => {
  assert.equal(shouldParentHandleEscape(fakeEvent('Enter', fakeRoot(false))), false);
  assert.equal(shouldParentHandleEscape(fakeEvent('Escape', fakeRoot(false))), true);
  assert.equal(shouldParentHandleEscape(null), false);
  assert.equal(shouldParentHandleEscape(undefined), false);
  assert.equal(shouldParentHandleEscape({}), false);
});
