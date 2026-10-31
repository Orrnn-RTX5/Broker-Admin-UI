import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMarketWatchSymbolDetails,
  formatDailyChange,
  formatMarketWatchDetailsNumber,
  formatMarketWatchDetailsPrice,
  readMarketWatchSymbolSpecification,
} from './marketWatchSymbolDetailsModel.js';
import {
  buildTickChartCrosshair,
  buildTickChartGeometry,
  MARKET_WATCH_TICK_CHART_LIMIT,
} from './tickChartGeometry.js';
import {
  buildMt5TickChartContextMenuItems,
  exportTickChartImage,
} from './marketWatchSymbolMenuModel.js';

const dockSrc = readFileSync(new URL('./MarketWatchDock.jsx', import.meta.url), 'utf8');
const viewsCssSrc = readFileSync(new URL('./market-watch-views.css', import.meta.url), 'utf8');

test('Admin marketWatchSymbolDetailsModel resolves nested specifications and preserves exact precision', () => {
  const spec = readMarketWatchSymbolSpecification(
    {
      trading_conditions: {
        tick_size: 0.001,
        tick_value: 5,
        digits: 3,
      },
      digits: 2,
    },
    null
  );
  assert.equal(spec.tickSize, 0.001);
  assert.equal(spec.tickValue, 5);
  assert.equal(spec.digits, 3);
  assert.equal(formatMarketWatchDetailsPrice(145.6, spec.digits), '145.600');
  assert.equal(formatMarketWatchDetailsPrice(145.67891, null), '145.67891');
  assert.equal(formatMarketWatchDetailsNumber(0.00001), '0.00001');
});

test('Admin buildMarketWatchSymbolDetails computes daily change and clamps session high/low', () => {
  const details = buildMarketWatchSymbolDetails({
    symbol: 'EURUSD',
    instrument: {
      spec: {
        tick_size: 0.00001,
        tick_value: 1,
        digits: 5,
      },
    },
    tick: {
      bid: 1.085,
      ask: 1.0852,
      daily_open: 1.08,
      previous_close: 1.0825,
      session: {
        high_bid: 1.084,
        low_bid: 1.079,
        high_ask: 1.0845,
        low_ask: 1.0795,
      },
    },
  });

  assert.equal(details.hasLiveQuote, true);
  assert.equal(details.bidHigh, 1.085);
  assert.equal(details.bidLow, 1.079);
  assert.equal(details.askHigh, 1.0852);
  assert.equal(details.askLow, 1.0795);
  assert.equal(formatDailyChange(details.dailyChangePrice, 5, false), '+0.00250');
  assert.equal(formatDailyChange(details.dailyChange, 2, true), '+0.23%');
});

test('Admin buildTickChartGeometry and buildTickChartCrosshair support 2000-tick buffer and crosshair', () => {
  assert.equal(MARKET_WATCH_TICK_CHART_LIMIT, 2_000);
  const ticks = [
    { timestamp: 1700000000000, bid: 100.1, ask: 100.3, last: 100.2 },
    { timestamp: 1700000001000, bid: 100.4, ask: 100.6, last: 100.5 },
  ];
  const geometry = buildTickChartGeometry(ticks, {
    width: 280,
    height: 220,
    fontSize: 11,
    digits: 2,
    includeLast: true,
    formatDate: () => '2026.10.28',
    formatTime: () => '12:00:00',
  });
  assert.ok(geometry);
  assert.equal(geometry.bidTag.label, '100.40');
  assert.equal(geometry.askTag.label, '100.60');
  assert.equal(geometry.lastTag?.label, '100.50');

  const crosshair = buildTickChartCrosshair(
    geometry,
    { x: geometry.plot.left + 10, y: geometry.plot.top + 20 },
    { width: 280, height: 220, fontSize: 11, digits: 2, formatDate: () => '2026.10.28', formatTime: () => '12:00:00' }
  );
  assert.ok(crosshair);
  assert.equal(crosshair.timeLabel, '2026.10.28 12:00:00');
});

test('MarketWatchDock.jsx and market-watch-views.css include all 12 Details rows and 12 Ticks SVG layers', () => {
  for (const rowKey of [
    'tickSize', 'tickValue', 'bid', 'bidHigh', 'bidLow',
    'ask', 'askHigh', 'askLow', 'dailyChangePrice', 'dailyChange', 'open', 'close',
  ]) {
    assert.ok(dockSrc.includes(`key: '${rowKey}'`), `Details row ${rowKey} must be rendered`);
  }
  assert.ok(dockSrc.includes('rtx-market-watch-details__list'), 'Details dl list class must exist');
  assert.ok(dockSrc.includes('rtx-market-tick-chart__crosshair'), 'Tick chart crosshair layer must exist');
  assert.ok(dockSrc.includes('rtx-market-tick-chart__price-lines'), 'Tick chart price reference lines must exist');
  assert.ok(viewsCssSrc.includes(".rtx-market-watch-details[data-grid='false']"), 'Details grid CSS must exist');
  assert.ok(viewsCssSrc.includes('.rtx-market-tick-chart__tag--crosshair'), 'Tick chart crosshair CSS must exist');
});

test('Admin buildMt5TickChartContextMenuItems provides exact MT5 Ticks right-click options and Save action', () => {
  const actions = [];
  const items = buildMt5TickChartContextMenuItems({
    tickSourceMode: 'current',
    autoScroll: true,
    crosshairEnabled: true,
    showBidLine: true,
    showAskLine: true,
    showLastLine: true,
    showTickGrid: true,
    onSelectTickSource: (mode) => actions.push(mode),
    onSaveTickChart: () => actions.push('save'),
    onToggleAutoScroll: () => actions.push('autoScroll'),
    onToggleCrosshair: () => actions.push('crosshair'),
    onToggleBidLine: () => actions.push('bidLine'),
    onToggleAskLine: () => actions.push('askLine'),
    onToggleLastLine: () => actions.push('lastLine'),
    onToggleGrid: () => actions.push('grid'),
  });

  const labels = items.map((item) => item.divider ? '---' : `${item.checked ? '[x] ' : '[ ] '}${item.label}${item.shortcut ? ` (${item.shortcut})` : ''}`);
  assert.deepEqual(labels, [
    '[x] Current',
    '[ ] Request',
    '[ ] Save',
    '---',
    '[x] Auto Scroll (S)',
    '[x] Crosshair (C)',
    '[x] Bid Line (B)',
    '[x] Ask Line (A)',
    '[x] Last Line (L)',
    '[x] Grid (G)',
  ]);

  const saveItem = items.find((item) => item.key === 'save');
  assert.ok(saveItem);
  saveItem.onSelect();
  assert.deepEqual(actions, ['save']);
  assert.equal(exportTickChartImage(null, 'EURUSD'), false);
});
