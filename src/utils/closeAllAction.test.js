import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getCloseAllActionState,
  getCloseAllConfirmationPrompt,
  isCloseAllConfirmationAccepted,
  normalizeCloseAllSymbol,
} from './closeAllAction.js';
import { PERMISSION_KEYS } from './permissions.js';

test('getCloseAllActionState fails closed without close_positions permission', () => {
  const state = getCloseAllActionState({
    user: { role: 'manager', permissions: ['view_positions'] },
    symbol: 'EURUSD',
  });

  assert.equal(state.canSubmit, false);
  assert.equal(state.hasClosePermission, false);
  assert.match(state.disabledReason, /close_positions/);
});

test('getCloseAllActionState allows close_positions permission with a symbol', () => {
  const state = getCloseAllActionState({
    user: { role: 'manager', permissions: [PERMISSION_KEYS.CLOSE_POSITIONS] },
    symbol: ' EURUSD ',
  });

  assert.equal(state.canSubmit, true);
  assert.equal(state.hasClosePermission, true);
  assert.equal(state.normalizedSymbol, 'EURUSD');
});

test('getCloseAllActionState requires a symbol and blocks duplicate submit while busy', () => {
  const user = { role: 'manager', permissions: [PERMISSION_KEYS.CLOSE_POSITIONS] };

  assert.equal(getCloseAllActionState({ user, symbol: '' }).canSubmit, false);
  assert.match(getCloseAllActionState({ user, symbol: '' }).disabledReason, /symbol/i);

  const busy = getCloseAllActionState({ user, symbol: 'XAUUSD', busy: true });
  assert.equal(busy.canSubmit, false);
  assert.match(busy.disabledReason, /running/i);
});

test('close-all confirmation requires the exact trimmed symbol', () => {
  assert.equal(normalizeCloseAllSymbol(' EURUSD '), 'EURUSD');
  assert.match(getCloseAllConfirmationPrompt('EURUSD'), /Type EURUSD/);
  assert.equal(isCloseAllConfirmationAccepted('EURUSD', ' EURUSD '), true);
  assert.equal(isCloseAllConfirmationAccepted('EURUSD', 'GBPUSD'), false);
  assert.equal(isCloseAllConfirmationAccepted('EURUSD', null), false);
});
