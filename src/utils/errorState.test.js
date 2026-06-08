import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildActionableErrorState } from './errorState.js';

test('buildActionableErrorState extracts backend detail and keeps retry label', () => {
  assert.deepEqual(
    buildActionableErrorState(
      { response: { data: { message: 'Gateway timeout' } } },
      { title: 'Managers failed to load', actionLabel: 'Refresh' }
    ),
    {
      title: 'Managers failed to load',
      detail: 'Gateway timeout',
      actionLabel: 'Refresh',
    }
  );
});

test('buildActionableErrorState accepts composed partial-load messages', () => {
  assert.deepEqual(
    buildActionableErrorState('Symbols: network down Categories: 500', {
      title: 'Symbols partially loaded',
      actionLabel: 'Retry',
    }),
    {
      title: 'Symbols partially loaded',
      detail: 'Symbols: network down Categories: 500',
      actionLabel: 'Retry',
    }
  );
});
