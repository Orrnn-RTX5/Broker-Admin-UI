import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInternalRouteOption, selectRouteOption, selectRoutingMode } from './lpRouting.js';

// Generic fixtures: internal status comes only from backend metadata flags,
// never from a route/tenant name.
const internalByFlag = { name: 'Internal Desk', route_value: 'internal-desk', is_internal_route: true };
const internalByMode = { name: 'House Account', route_value: 'house', routing_mode: 'b_book' };
const external = { name: 'External LP', route_value: 'LP1', routing_mode: 'a_book' };
const unflagged = { name: 'Prime Liquidity', route_value: 'prime-1' };
const options = [internalByFlag, external];

test('backend flags identify the internal route', () => {
  assert.equal(isInternalRouteOption(internalByFlag), true);
  assert.equal(isInternalRouteOption(internalByMode), true);
  assert.equal(isInternalRouteOption(external), false);
  assert.equal(isInternalRouteOption(unflagged), false);
  assert.equal(isInternalRouteOption(null), false);
  assert.equal(isInternalRouteOption({}), false);
});

test('route names never decide internal routing, including brand-like names', () => {
  for (const name of ['ORRNN', 'orrnn', 'Orrnn', 'HOUSE', 'B-BOOK', 'INTERNAL']) {
    assert.equal(
      isInternalRouteOption({ name, route_value: name }),
      false,
      `route name "${name}" without backend flags must not route as B-book`
    );
  }
});

test('selecting an internal route replaces incompatible hybrid mode with B-Book', () => {
  assert.deepEqual(
    selectRouteOption({ routing_mode: 'hybrid' }, internalByFlag),
    { routing_mode: 'b_book', lp_name: 'internal-desk' }
  );
});

test('external choice uses route value and preserves hybrid, but exits B-Book', () => {
  assert.deepEqual(selectRouteOption({ routing_mode: 'hybrid' }, external), { routing_mode: 'hybrid', lp_name: 'LP1' });
  assert.equal(selectRouteOption({ routing_mode: 'b_book' }, external).routing_mode, 'a_book');
});

test('changing modes cannot retain an incompatible LP', () => {
  assert.equal(selectRoutingMode({ lp_name: 'internal-desk' }, 'hybrid', options).lp_name, '');
  assert.equal(selectRoutingMode({ lp_name: 'LP1' }, 'b_book', options).lp_name, 'internal-desk');
  assert.equal(selectRoutingMode({ lp_name: 'LP1' }, 'hybrid', options).lp_name, 'LP1');
});

test('no flagged internal LP does not fabricate a choice', () => {
  assert.equal(selectRoutingMode({ lp_name: 'LP1' }, 'b_book', [external]).lp_name, '');
});
