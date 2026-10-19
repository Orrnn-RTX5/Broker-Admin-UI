import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GROUP_PARENT_LOOKUP_DEBOUNCE_MS,
  isGroupLookupNotFound,
} from './groupParentLookup.js';

test('parent-group lookup is debounced and treats 404 as available', () => {
  assert.equal(GROUP_PARENT_LOOKUP_DEBOUNCE_MS, 400);
  assert.equal(isGroupLookupNotFound({ response: { status: 404 } }), true);
  assert.equal(isGroupLookupNotFound({ status: 404 }), true);
  assert.equal(isGroupLookupNotFound({ response: { status: 500 } }), false);
  assert.equal(isGroupLookupNotFound(new Error('network')), false);
  assert.equal(isGroupLookupNotFound(undefined), false);
});
