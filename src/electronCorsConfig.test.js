import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  collectBrokerOrigins,
  createCorsHeaders,
  getExtApiRedirectUrl,
  shouldApplyCorsHeaders,
} from '../electron/corsConfig.js';

test('Electron CORS origins include packaged Vite env and explicit broker origin lists', () => {
  const origins = collectBrokerOrigins({
    VITE_API_HOST: 'https://broker.example.com/',
    VITE_API_HOST_EXT: 'broker.example.com:8091',
    VITE_API_URL: 'https://alias-broker.example.com/',
    VITE_API_EXT_URL: 'alias-broker.example.com:8091',
    RTX5_BROKER_ORIGINS: 'https://selected.example.com, http://selected.example.com:8091',
  });

  assert.deepEqual(new Set(origins), new Set([
    'https://broker.example.com',
    'https://broker.example.com:8091',
    'https://alias-broker.example.com',
    'https://alias-broker.example.com:8091',
    'https://selected.example.com',
    'http://selected.example.com:8091',
  ]));
});

test('Electron CORS shim only applies to configured or selected broker origins', () => {
  const origins = ['https://selected.example.com', 'http://selected.example.com:8091'];

  assert.equal(
    shouldApplyCorsHeaders({ url: 'https://selected.example.com/api/v2/admin/instruments/EURUSD/toggle' }, origins),
    true
  );
  assert.equal(
    shouldApplyCorsHeaders({ url: 'https://unexpected.example.com/api/v2/admin/instruments/EURUSD/toggle' }, origins),
    false
  );
});

test('Electron CORS headers grant null origin without preserving credentialed wildcard headers', () => {
  const headers = createCorsHeaders({
    Server: ['nginx'],
    'Access-Control-Allow-Origin': ['*'],
    'Access-Control-Allow-Credentials': ['true'],
  });

  assert.equal(headers.Server[0], 'nginx');
  assert.deepEqual(headers['Access-Control-Allow-Origin'], ['null']);
  assert.equal(headers['Access-Control-Allow-Credentials'], undefined);
  assert.match(headers['Access-Control-Allow-Methods'][0], /PATCH/);
});

test('Electron ext-api redirect only rewrites configured API origin ext-api paths', () => {
  assert.equal(
    getExtApiRedirectUrl(
      'https://broker.example.com/ext-api/SessionOverrideSet?symbol=EURUSD',
      'https://broker.example.com',
      'http://broker.example.com:8091'
    ),
    'http://broker.example.com:8091/SessionOverrideSet?symbol=EURUSD'
  );

  assert.equal(
    getExtApiRedirectUrl(
      'https://selected.example.com/ext-api/SessionOverrideSet',
      'https://broker.example.com',
      'http://broker.example.com:8091'
    ),
    ''
  );
});
