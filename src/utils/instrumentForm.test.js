import {test} from 'node:test';
import assert from 'node:assert/strict';
import {instrumentForm, instrumentPayload, cryptoSessions, applyCryptoTemplate, usesCryptoDefaults, instrumentCategories, categoryTemplate, applyCategoryTemplate, defaultCategory} from './instrumentForm.js';
const valid = () => ({symbol: 'ETHUSD', category: 'Crypto', symbol_timezone: 'UTC', description: 'Ether', enabled: true, digits: '2', contract_size: '1', tick_size: '0.01', tick_value: '0.01', spread: '0', margin_rate: '1', calc_mode: 'cfd_leverage', margin_currency: 'USD', profit_currency: 'USD', min_volume: '0.01', max_volume: '100', volume_step: '0.01', sessions: cryptoSessions()});

test('all six category starters produce editable valid disabled instruments', () => {
  for (const category of instrumentCategories) {
    const template = categoryTemplate(category);
    const result = applyCategoryTemplate(instrumentForm({symbol: 'TEST', description: 'Keep identity'}), category, template);
    const payload = instrumentPayload(result);
    assert.equal(payload.enabled, false);
    assert.equal(payload.category, category);
    assert.equal(payload.description, 'Keep identity');
    assert.equal(payload.sessions.length, category === 'Crypto' ? 7 : 5);
    assert.match(template.label, /starter/);
  }
});

test('category switch replaces stale crypto economics and weekend schedule', () => {
  const original = {...valid(), contract_size: 9, symbol_timezone: 'Asia/Tokyo'};
  const result = applyCategoryTemplate(original, 'Forex', categoryTemplate('Forex'));
  assert.equal(result.contract_size, 100000);
  assert.equal(result.calc_mode, 'forex');
  assert.equal(result.digits, 5);
  assert.equal(result.symbol_timezone, 'UTC');
  assert.deepEqual(result.sessions.map(row => row.day_of_week), [1, 2, 3, 4, 5]);
  assert.equal(result.enabled, false);
  assert.equal(original.sessions.length, 7);
});

test('same-category broker templates and authoritative feed values take priority', () => {
  const sessions = [{day_of_week: 1, quote_from: '09:00', quote_to: '17:00', trade_from: '10:00', trade_to: '16:00'}];
  const template = categoryTemplate('Forex', [valid(), {...valid(), symbol: 'EURUSD', category: 'forex', contract_size: 10, sessions, symbol_timezone: 'Europe/London'}]);
  const result = applyCategoryTemplate(instrumentForm({symbol: 'GBPUSD'}), 'Forex', template, {contract_size: 25, spread: 0, margin_rate: 0, digits: null});
  assert.equal(result.contract_size, 25);
  assert.equal(result.spread, 0);
  assert.equal(result.margin_rate, 0);
  assert.equal(result.digits, '2');
  assert.equal(result.symbol_timezone, 'Europe/London');
  assert.deepEqual(result.sessions, sessions);
  result.sessions[0].trade_from = '11:00';
  assert.equal(sessions[0].trade_from, '10:00');
  assert.match(template.label, /EURUSD/);
});

test('custom categories never inherit unrelated category economics', () => {
  assert.equal(categoryTemplate('', [{...valid(), category: ''}]), null);
  assert.equal(categoryTemplate('Custom', [valid()]), null);
  const result = applyCategoryTemplate(valid(), 'Custom', null);
  assert.equal(result.contract_size, '');
  assert.equal(result.calc_mode, '');
  assert.deepEqual(result.sessions, []);
  assert.equal(result.enabled, false);
  assert.equal(categoryTemplate('Custom', [{...valid(), category: 'Custom'}]).values.contract_size, '1');
  assert.equal(defaultCategory({symbol: 'ETHUSD'}), 'Crypto');
  assert.equal(defaultCategory({symbol: 'ETHUSD', category: 'Custom'}), 'Custom');
  assert.equal(defaultCategory({symbol: 'GBPUSD'}), 'Forex');
});

test('symbol selection resolves category and fills the corresponding complete defaults', () => {
  for (const [symbol, category, contract, mode] of [
    ['XAUUSD', 'Metals', 100, 'cfd_leverage'],
    ['GBPUSD', 'Forex', 100000, 'forex'],
    ['EURUSD', 'Forex', 100000, 'forex'],
    ['BTCUSD', 'Crypto', 1, 'cfd_leverage'],
    ['US30', 'Indices', 1, 'cfd_leverage'],
  ]) {
    const source = {symbol};
    const detected = defaultCategory(source);
    assert.equal(detected, category);
    const form = applyCategoryTemplate(instrumentForm(source), detected, categoryTemplate(detected), source);
    assert.equal(form.contract_size, contract);
    assert.equal(form.calc_mode, mode);
    assert.equal(instrumentPayload(form).category, category);
    assert.equal(form.enabled, false);
  }
});

test('classification handles broker suffixes and respects supplied or configured categories', () => {
  for (const symbol of ['XAUUSD.pro', 'XAGUSD_raw', 'XAUUSD-ECN', 'xauusd']) assert.equal(defaultCategory({symbol}), 'Metals');
  assert.equal(defaultCategory({symbol: 'GBPJPY.pro'}), 'Forex');
  assert.equal(defaultCategory({symbol: 'ETHUSDT'}), 'Crypto');
  assert.equal(defaultCategory({symbol: 'AAPL'}, [{symbol: 'AAPL', category: 'Stocks'}]), 'Stocks');
  assert.equal(defaultCategory({symbol: 'ESZ26', category: 'futures'}), 'Futures');
  assert.equal(defaultCategory({symbol: 'XAUUSD', category: 'Custom Metals'}), 'Custom Metals');
  for (const symbol of ['', 'UNKNOWN', 'ABCDEF', 'USDUSD', 'GOLDEN', 'XAUUSDX']) assert.equal(defaultCategory({symbol}), '');
});

test('feed schedule overrides broker schedule and reset restores edited values', () => {
  const template = categoryTemplate('Metals');
  const source = {sessions: [cryptoSessions()[2]], symbol_timezone: 'Asia/Tokyo', tick_size: 0.1};
  const result = applyCategoryTemplate({...valid(), tick_size: 999}, 'Metals', template, source);
  assert.equal(result.tick_size, 0.1);
  assert.deepEqual(result.sessions, source.sessions);
  assert.equal(result.symbol_timezone, 'Asia/Tokyo');
  assert.equal(result.contract_size, 100);
});

test('automatic crypto defaults require a known crypto symbol or explicit crypto category', () => {
  for (const symbol of ['BTCUSD', 'ETHUSD', 'SOLUSD']) assert.equal(usesCryptoDefaults({symbol}), true);
  assert.equal(usesCryptoDefaults({symbol: 'EURUSD'}), false);
  assert.equal(usesCryptoDefaults({symbol: 'XAUUSD'}), false);
  assert.equal(usesCryptoDefaults({symbol: 'ETHUSD', category: 'Custom contract'}), false);
  assert.equal(usesCryptoDefaults({symbol: 'OTHER', category: 'Crypto'}), true);
});

test('explicit crypto template copies economics without copying identity or enabling trading', () => {
  const form = instrumentForm({symbol: 'SOLUSD', description: 'Solana'});
  const result = applyCryptoTemplate(form, {...valid(), symbol: 'BTCUSD', id: 123});
  assert.equal(result.symbol, 'SOLUSD');
  assert.equal(result.description, 'Solana');
  assert.equal(result.id, undefined);
  assert.equal(result.enabled, false);
  assert.equal(result.contract_size, '1');
  assert.equal(result.sessions.length, 7);
  assert.equal(form.contract_size, '');
});

test('crypto template respects authoritative feed specifications including zero spread', () => {
  const result = applyCryptoTemplate(instrumentForm({symbol: 'ETHUSD'}), {...valid(), spread: 10}, {contract_size: 5, spread: 0, digits: null});
  assert.equal(result.contract_size, 5);
  assert.equal(result.spread, 0);
  assert.equal(result.digits, '2');
});

test('crypto template preserves an explicitly configured restricted schedule', () => {
  const form = instrumentForm({symbol: 'ETHUSD', sessions: [{day_of_week: 1, quote_from: '08:00', quote_to: '18:00', trade_from: '09:00', trade_to: '17:00'}]});
  assert.deepEqual(applyCryptoTemplate(form, valid()).sessions, form.sessions);
});
test('empty or feed-name-only form never guesses contract economics or enables trading', () => {
  assert.deepEqual(instrumentForm(null), instrumentForm());
  const form = instrumentForm({symbol: 'ETHUSD'});
  assert.equal(form.contract_size, ''); assert.equal(form.digits, ''); assert.equal(form.enabled, false);
  assert.throws(() => instrumentPayload(form), /required/);
});
test('payload preserves explicit economics and reviewed weekend schedule', () => {
  const payload = instrumentPayload(valid());
  assert.equal(payload.contract_size, 1); assert.equal(payload.spread, 0);
  assert.equal(payload.sessions.length, 7); assert.equal(payload.sessions[0].trade_to, '24:00');
  assert.equal(payload.description, 'Ether'); assert.equal(payload.enabled, true);
});
test('readback of full-day database time remains full-day in editor', () => {
  const form = instrumentForm({...valid(), sessions: [{day_of_week: 0, quote_from: '00:00:00', quote_to: '00:00:00', trade_from: '00:00:00', trade_to: '00:00:00'}]});
  assert.equal(instrumentPayload(form).sessions[0].trade_to, '24:00');
});
test('invalid specifications and schedules fail before writes', () => {
  for (const changes of [{symbol: 'ethusd'}, {symbol: 'A'.repeat(21)}, {contract_size: ''}, {tick_value: 0}, {min_volume: 200}, {volume_step: 0.03}, {digits: 1.5}, {calc_mode: 'unsupported'}, {sessions: []}, {symbol_timezone: 'nonsense'}, {sessions: [{day_of_week: 0, quote_from: '08:00', quote_to: '18:00', trade_from: '07:00', trade_to: '18:00'}]}]) {
    assert.throws(() => instrumentPayload({...valid(), ...changes}));
  }
});

test('existing inherited quote hours and Sunday overnight opening retain effective times', () => {
  const payload = instrumentPayload({...valid(), sessions: [{day_of_week: 0, quote_from: null, quote_to: null, trade_from: '21:00:00', trade_to: '00:00:00'}]});
  assert.equal(payload.sessions[0].quote_from, '21:00');
  assert.equal(payload.sessions[0].quote_to, '00:00');
  assert.equal(payload.sessions[0].trade_from, '21:00');
  assert.equal(payload.sessions[0].trade_to, '00:00');
});

test('overnight containment and week-boundary overlaps match server validation', () => {
  const saturday = {day_of_week: 6, quote_from: '21:00', quote_to: '02:00', trade_from: '00:00', trade_to: '01:00'};
  assert.equal(instrumentPayload({...valid(), sessions: [saturday]}).sessions.length, 1);
  assert.throws(() => instrumentPayload({...valid(), sessions: [saturday, cryptoSessions()[0]]}), /overlap/);
  assert.throws(() => instrumentPayload({...valid(), sessions: [saturday, saturday]}), /one session/);
  assert.throws(() => instrumentPayload({...valid(), sessions: [{...saturday, trade_to: '03:00'}]}), /fit inside/);
});

test('stops_level_points defaults to 0 when blank, preserves positive integers, and rejects invalid values', () => {
  assert.equal(instrumentPayload(valid()).stops_level_points, 0);
  assert.equal(instrumentPayload({...valid(), stops_level_points: ''}).stops_level_points, 0);
  assert.equal(instrumentPayload({...valid(), stops_level_points: '0'}).stops_level_points, 0);
  assert.equal(instrumentPayload({...valid(), stops_level_points: '25'}).stops_level_points, 25);
  assert.equal(instrumentForm({symbol: 'EURUSD', stops_level_points: 18}).stops_level_points, 18);
  assert.equal(instrumentForm({symbol: 'EURUSD', stopsLevelPoints: 12}).stops_level_points, 12);
  for (const bad of ['-1', '1.5', '2147483648', 'abc']) {
    assert.throws(() => instrumentPayload({...valid(), stops_level_points: bad}), /stops level points|Stops level/i);
  }
});
