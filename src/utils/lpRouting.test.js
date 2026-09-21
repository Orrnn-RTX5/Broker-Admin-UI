import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectRouteOption, selectRoutingMode } from './lpRouting.js';

const internal = { name: 'ORRNN', route_value: 'ORRNN', is_internal_route: true };
const external = { name: 'External LP', route_value: 'LP1', routing_mode: 'a_book' };
const options = [internal, external];

test('selecting ORRNN replaces incompatible hybrid mode with B-Book', () => {
  assert.deepEqual(selectRouteOption({ routing_mode: 'hybrid' }, internal), { routing_mode: 'b_book', lp_name: 'ORRNN' });
});
test('external choice uses route value and preserves hybrid, but exits B-Book', () => {
  assert.deepEqual(selectRouteOption({ routing_mode: 'hybrid' }, external), { routing_mode: 'hybrid', lp_name: 'LP1' });
  assert.equal(selectRouteOption({ routing_mode: 'b_book' }, external).routing_mode, 'a_book');
});
test('changing modes cannot retain an incompatible LP', () => {
  assert.equal(selectRoutingMode({ lp_name: 'ORRNN' }, 'hybrid', options).lp_name, '');
  assert.equal(selectRoutingMode({ lp_name: 'LP1' }, 'b_book', options).lp_name, 'ORRNN');
  assert.equal(selectRoutingMode({ lp_name: 'LP1' }, 'hybrid', options).lp_name, 'LP1');
});
test('no configured internal LP does not fabricate an ORRNN choice', () => {
  assert.equal(selectRoutingMode({ lp_name: 'LP1' }, 'b_book', [external]).lp_name, '');
});
