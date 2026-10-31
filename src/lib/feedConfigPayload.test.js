import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CATALOG_SYMBOLS,
  buildFeedConfigPayload,
  normalizeFeedProvider,
  parseCatalogSymbols,
  parseFeedConfigImport,
} from './feedConfigPayload.js';

const baseForm = {
  feed_provider: 'rtxmd',
  enabled: true,
  host: ' fix.example.com ',
  port: '32302',
  sender_comp_id: ' SENDER ',
  target_comp_id: ' cServer ',
  username: ' fix-user ',
  password: '',
  use_ssl: true,
  all_symbols: false,
  symbols: '',
  catalog_file: ' catalog.json ',
};

test('cserver.symbols is a comma-separated string, never an array', () => {
  const payload = buildFeedConfigPayload({ ...baseForm, symbols: ' EURUSD , XAUUSD ' });
  assert.equal(typeof payload.cserver.symbols, 'string');
  assert.equal(payload.cserver.symbols, 'EURUSD,XAUUSD');

  const empty = buildFeedConfigPayload(baseForm);
  assert.ok(!Array.isArray(empty.cserver.symbols));
  assert.equal(empty.cserver.symbols, '');

  const wire = JSON.parse(JSON.stringify(payload));
  assert.equal(wire.cserver.symbols, 'EURUSD,XAUUSD');
});

test('payload matches the manager feed-config request shape for rtxmd', () => {
  const payload = buildFeedConfigPayload(baseForm);
  assert.deepEqual(payload, {
    feed_provider: 'rtxmd',
    enabled: true,
    cserver: {
      host: 'fix.example.com',
      port: 32302,
      sender_comp_id: 'SENDER',
      target_comp_id: 'cServer',
      username: 'fix-user',
      use_ssl: true,
      symbols: '',
      catalog_file: 'catalog.json',
    },
  });
});

test('all-symbols toggle maps to an empty cserver.symbols string', () => {
  const payload = buildFeedConfigPayload({
    ...baseForm,
    all_symbols: true,
    symbols: 'EURUSD,XAUUSD',
  });

  assert.equal(payload.cserver.symbols, '');
});

test('password is write-only: sent untrimmed only when typed, omitted otherwise', () => {
  assert.ok(!('password' in buildFeedConfigPayload(baseForm)));
  const withPassword = buildFeedConfigPayload({ ...baseForm, password: ' p@ss word ' });
  assert.equal(withPassword.password, ' p@ss word ');
});

test('provider aliases normalize to the feed-provider ids used by the UI', () => {
  assert.equal(normalizeFeedProvider('RTX Market Data FIX Upstream'), 'rtxmd');
  assert.equal(normalizeFeedProvider('cServer'), 'equinix');
  assert.equal(normalizeFeedProvider('Tools for Brokers'), 't4b');
});

test('imports SuperAdmin JSON feed config', () => {
  const imported = parseFeedConfigImport(JSON.stringify({
    feed_provider: 'RTX Market Data FIX Upstream',
    enabled: true,
    cserver: {
      host: 'md.superadmin.example.com',
      port: 5211,
      sender_comp_id: 'BROKER_MD',
      target_comp_id: 'RTXMD',
      username: 'broker-md',
      password: ' md secret ',
      use_ssl: false,
      symbols: ['EURUSD', 'XAUUSD'],
      catalog_file: 'catalog/rtxmd.json',
    },
  }));

  assert.deepEqual(imported, {
    feed_provider: 'rtxmd',
    enabled: true,
    host: 'md.superadmin.example.com',
    port: '5211',
    sender_comp_id: 'BROKER_MD',
    target_comp_id: 'RTXMD',
    username: 'broker-md',
    catalog_file: 'catalog/rtxmd.json',
    use_ssl: false,
    password: ' md secret ',
    all_symbols: false,
    symbols: 'EURUSD,XAUUSD',
  });
});

test('imports SuperAdmin env and INI config with all-symbols mapping', () => {
  const imported = parseFeedConfigImport(`
    FEED_PROVIDER=rtx_market_data_fix
    CSERVER_ENABLED=yes
    CSERVER_HOST=md.superadmin.example.com
    CSERVER_PORT=5211
    CSERVER_SENDER_COMP_ID=BROKER_MD
    CSERVER_TARGET_COMP_ID=RTXMD
    CSERVER_USERNAME=broker-md
    CSERVER_PASSWORD="md-secret"
    CSERVER_USE_SSL=true

    [cserver]
    symbols=ALL
    catalog_file=rtxmd-symbols.json
  `);

  assert.deepEqual(imported, {
    feed_provider: 'rtxmd',
    enabled: true,
    host: 'md.superadmin.example.com',
    port: '5211',
    sender_comp_id: 'BROKER_MD',
    target_comp_id: 'RTXMD',
    username: 'broker-md',
    catalog_file: 'rtxmd-symbols.json',
    use_ssl: true,
    password: 'md-secret',
    all_symbols: true,
    symbols: '',
  });
});

test('authorized sender catalog: explicit, unique, comma or line separated', () => {
  assert.deepEqual(parseCatalogSymbols(' AAA1, BBB2\nccc3;aaa1  BBB2 '), { symbols: ['AAA1', 'BBB2', 'ccc3'], error: '' });
  assert.deepEqual(parseCatalogSymbols(''), { symbols: [], error: '' });
  assert.match(parseCatalogSymbols('AAA1, *').error, /not \* or ALL/);
  assert.match(parseCatalogSymbols('all').error, /not \* or ALL/);
  const tooMany = Array.from({ length: MAX_CATALOG_SYMBOLS + 1 }, (_, i) => `S${i}`).join(',');
  assert.match(parseCatalogSymbols(tooMany).error, /at most 2048/);
  assert.equal(parseCatalogSymbols(Array.from({ length: MAX_CATALOG_SYMBOLS }, (_, i) => `S${i}`).join(',')).error, '');
});

test('catalog_symbols is sent only when known or entered, as a CSV string', () => {
  assert.equal('catalog_symbols' in buildFeedConfigPayload(baseForm).cserver, false, 'omitted = unchanged on the server');
  const known = buildFeedConfigPayload({ ...baseForm, catalog_symbols: '', catalog_symbols_known: true });
  assert.equal(known.cserver.catalog_symbols, '', 'a cleared catalog is sent as empty');
  const entered = buildFeedConfigPayload({ ...baseForm, catalog_symbols: 'AAA1,\n BBB2, AAA1' });
  assert.equal(entered.cserver.catalog_symbols, 'AAA1,BBB2');
  assert.throws(() => buildFeedConfigPayload({ ...baseForm, catalog_symbols: '*' }), /not \* or ALL/);
  const allMode = buildFeedConfigPayload({ ...baseForm, all_symbols: true, symbols: 'X', catalog_symbols: 'AAA1', catalog_symbols_known: true });
  assert.equal(allMode.cserver.symbols, '');
  assert.equal(allMode.cserver.catalog_symbols, 'AAA1');
});
