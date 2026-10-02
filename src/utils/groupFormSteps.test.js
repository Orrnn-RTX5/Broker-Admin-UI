import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGroupForm, validateGroupSection } from './groupFormSteps.js';

const complete = { name: 'Broker/real', currency: 'USD', leverage: 100, spreadMarkup: 0, commissionRate: 0, marginCallLevel: 100, stopOutLevel: 50, symbolsAllowed: '' };
test('General requires a meaningful name and currency', () => {
  assert.equal(validateGroupSection({ ...complete, name: '  ' }, 'details').field, 'name');
  assert.equal(validateGroupSection({ ...complete, currency: '' }, 'details').field, 'currency');
  assert.equal(validateGroupSection(complete, 'details'), null);
});
test('Trading blocks invalid leverage, blank amounts, and negative fees before advancing', () => {
  for (const value of [0, -1, 1.5, '', 'bad']) assert.equal(validateGroupSection({ ...complete, leverage: value }, 'trading').field, 'leverage');
  assert.equal(validateGroupSection({ ...complete, commissionRate: '' }, 'trading').field, 'commissionRate');
  assert.equal(validateGroupSection({ ...complete, spreadMarkup: -1 }, 'trading').field, 'spreadMarkup');
});
test('Risk rejects missing or negative thresholds and accepts zero', () => {
  assert.equal(validateGroupSection({ ...complete, marginCallLevel: '' }, 'risk').field, 'marginCallLevel');
  assert.equal(validateGroupSection({ ...complete, stopOutLevel: -1 }, 'risk').field, 'stopOutLevel');
  assert.equal(validateGroupSection({ ...complete, stopOutLevel: 0 }, 'risk'), null);
});
test('Final validation rechecks earlier sections while preserving optional symbols', () => {
  assert.equal(validateGroupForm(complete), null);
  assert.equal(validateGroupForm({ ...complete, leverage: -1 }).section, 'trading');
  assert.equal(validateGroupForm({ ...complete, stopOutLevel: '' }).section, 'risk');
});
