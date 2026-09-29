import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasGroupFormChanges } from './groupFormChanges.js';

const initial = {
  originalName: 'real\\standard',
  name: 'real\\standard',
  marginCallLevel: 100,
  stopOutLevel: 50,
  tradeAllowed: true,
  symbolsAllowed: 'EURUSD, XAUUSD',
};

test('an untouched group or formatting-only edits do not need an update', () => {
  assert.equal(hasGroupFormChanges(initial, { ...initial }), false);
  assert.equal(hasGroupFormChanges(initial, {
    ...initial,
    marginCallLevel: '100',
    symbolsAllowed: ' EURUSD ,  XAUUSD ',
  }), false);
});

test('changed group settings need an update, including after a previous edit is reverted', () => {
  assert.equal(hasGroupFormChanges(initial, { ...initial, marginCallLevel: '80' }), true);
  assert.equal(hasGroupFormChanges(initial, { ...initial, tradeAllowed: false }), true);
  assert.equal(hasGroupFormChanges(initial, { ...initial, symbolsAllowed: 'EURUSD' }), true);
  assert.equal(hasGroupFormChanges(initial, { ...initial, marginCallLevel: 'invalid' }), true);
  assert.equal(hasGroupFormChanges(initial, { ...initial, marginCallLevel: 100 }), false);
});
