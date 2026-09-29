import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');

test('Positions table maps live manager field variants into visible cells', () => {
  assert.match(src, /const getPositionRow = \(position, idx\) => \{/);
  assert.match(src, /raw:\s*position/);
  assert.match(src, /pickDefined\(position, \['position_ticket_text', 'ticket_text', 'ticket', 'positionTicket', 'Position', 'position', 'id'\], idx\)/);
  assert.match(src, /pickDefined\(position, \['login', 'Login', 'accountLogin', 'account_login'\]\)/);
  assert.match(src, /pickDefined\(position, \['symbol', 'Symbol'\]\)/);
  assert.match(src, /getTradeSideLabel\(pickDefined\(position, \['side', 'Side', 'action', 'Action', 'type', 'Type', 'cmd', 'Cmd'\]\)\)/);
  assert.match(src, /pickDefined\(position, \['priceOpen', 'PriceOpen', 'openPrice', 'OpenPrice', 'Price', 'price'\]\)/);
  assert.match(src, /pickDefined\(position, \['priceCurrent', 'PriceCurrent', 'currentPrice', 'CurrentPrice'\]\)/);
  assert.match(src, /getPagedMappedRows\(\{\s*response:\s*positionsResponse,/);
  assert.match(src, /keys:\s*\['data', 'positions', 'answer', 'items', 'rows'\]/);
  assert.match(src, /mapFn:\s*getPositionRow/);
});

test('Deals table maps live manager field variants into visible cells', () => {
  assert.match(src, /const getDealRow = \(deal, idx\) => \{/);
  assert.match(src, /raw:\s*deal/);
  assert.match(src, /pickDefined\(deal, \['ticket', 'Ticket', 'deal', 'Deal', 'id'\], idx\)/);
  assert.match(src, /pickDefined\(deal, \['orderTicket', 'OrderTicket', 'order', 'Order'\]\)/);
  assert.match(src, /pickDefined\(deal, \['login', 'Login', 'accountLogin', 'account_login'\]\)/);
  assert.match(src, /pickDefined\(deal, \['symbol', 'Symbol'\]\)/);
  assert.match(src, /getTradeSideLabel\(pickDefined\(deal, \['action', 'Action', 'side', 'Side', 'type', 'Type'\]\)\)/);
  assert.match(src, /pickDefined\(deal, \['commission', 'Commission'\]\)/);
  assert.match(src, /getPagedMappedRows\(\{\s*response:\s*dealsResponse,/);
  assert.match(src, /keys:\s*\['data', 'deals', 'answer', 'items', 'rows'\]/);
  assert.match(src, /mapFn:\s*getDealRow/);
});

test('Positions and Deals renderer shows a dash for missing cells instead of blank rows', () => {
  assert.match(src, /const renderTableValue = \(value\) => \(/);
  assert.match(src, /value === undefined \|\| value === null \|\| value === '' \? '-' : value/);
  assert.match(src, /\{renderTableValue\(displayVal\)\}/);
  assert.match(src, /viewType === 'Deals' && col\.label === 'Action'\s*\? formatDealActionLabel\(val\)/);
  assert.match(src, /viewType === 'Deals' && col\.label === 'Entry'\s*\? formatDealEntryLabel\(val\)/);
});
