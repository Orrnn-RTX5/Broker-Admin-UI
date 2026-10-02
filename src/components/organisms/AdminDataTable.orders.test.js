import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');
const indexCss = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

test('Orders view is wired to backend data instead of the coming-soon placeholder', () => {
  const comingSoonBlock = src.match(/const COMING_SOON_VIEWS = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? '';

  assert.doesNotMatch(comingSoonBlock, /'Orders'/);
  assert.match(src, /import\s+\{\s*usePositions,\s*useOrders,\s*useDealsSummary\s*\}/);
  assert.match(src, /useOrders\(\{\s*limit:\s*pageSize,\s*offset:\s*\(activePage - 1\) \* pageSize,/);
  assert.doesNotMatch(src, /allPages:\s*ordersMode === 'all'/);
  assert.match(src, /viewType === 'Orders'/);
  assert.match(src, /'Orders':\s*ordersError/);
});

test('Orders rows are rendered with order-specific fields', () => {
  assert.match(src, /const getOrderRow = \(order, idx\) => \(\{/);
  assert.match(src, /raw:\s*order/);
  assert.match(src, /ticket:\s*pickDefined\(order, \['ticket', 'Ticket', 'order', 'Order', 'orderTicket', 'OrderTicket'\]\)/);
  assert.match(src, /side:\s*pickDefined\(order, \['side', 'Side', 'action', 'Action', 'type', 'Type', 'cmd', 'Cmd'\]\)/);
  assert.match(src, /status:\s*pickDefined\(order, \['status', 'Status', 'state', 'State'\]\)/);
  assert.match(src, /comment:\s*pickDefined\(order, \['comment', 'Comment'\]\)/);
  assert.match(src, /if \(col\.label === 'Status'\) val = row\.status/);
  assert.match(src, /if \(col\.label === 'Comment'\) val = row\.comment/);
});

test('Orders filter bar is controlled by Orders state', () => {
  assert.match(src, /const \[ordersMode,\s*setOrdersMode\] = useState\('all'\)/);
  assert.match(src, /const \[orderFilters,\s*setOrderFilters\] = useState\(\(\) => createDefaultOrderFilters\(\)\)/);
  assert.match(src, /const \[page,\s*setPage\] = useState\(1\)/);
  assert.match(src, /const \[pageSize,\s*setPageSize\] = useState\(DEFAULT_PAGE_SIZE\)/);
  assert.match(src, /const \[debouncedOrderQuery,\s*setDebouncedOrderQuery\] = useState\(orderFilters\.query\)/);
  assert.match(src, /const filterOrderRows = \(rows, filters\) => \{/);
  assert.match(src, /orderSymbolOptions = getOrderSymbolOptions\(data\)/);
  assert.match(src, /const applyLocalOrderFilter = hasActiveOrderFilter\(effectiveOrderFilters\)/);
  assert.match(src, /filterFn:\s*applyLocalOrderFilter \? getOrderRecordFilter\(effectiveOrderFilters\) : undefined/);
  assert.match(src, /mapFn:\s*\(order, idx\) => getOrderDisplayRow\(getOrderRow\(order, idx\)\)/);
  assert.match(src, /checked=\{viewType === 'Orders' \? orderFilters\.openOnly : false\}/);
  assert.match(src, /value=\{viewType === 'Orders' \? orderFilters\.symbol : ''\}/);
});

test('Orders do not apply open or date filters by default', () => {
  assert.match(src, /openOnly:\s*false/);
  assert.match(src, /rangePreset:\s*'all'/);
  assert.match(src, /getOrderDateRangeForPreset\('all'\)/);
  assert.match(src, /if \(preset === 'all'\) \{\s*return \{\s*from: '',\s*to: '',\s*\};\s*\}/);
  assert.match(src, /<option value="all"[^>]*>All<\/option>/);
  assert.match(src, /value=\{viewType === 'Orders' \? orderFilters\.rangePreset : 'all'\}/);
});

test('Orders filter bar does not show the redundant manual request button', () => {
  assert.doesNotMatch(src, /ordersLoading \? 'Loading' : 'Request'/);
  assert.doesNotMatch(src, /onClick=\{viewType === 'Orders' \? handleOrderRequest : undefined\}/);
});

test('Orders date filters use native calendar pickers', () => {
  assert.match(src, /const orderFromDateInputRef = React\.useRef\(null\)/);
  assert.match(src, /const orderToDateInputRef = React\.useRef\(null\)/);
  assert.match(src, /const openOrderDatePicker = \(inputRef\) => \{/);
  assert.match(src, /input\.showPicker\(\)/);
  assert.match(src, /replace\('T', ' '\)/);
  assert.match(src, /type="datetime-local"/);
  assert.match(src, /ref=\{orderFromDateInputRef\}/);
  assert.match(src, /ref=\{orderToDateInputRef\}/);
  assert.match(src, /className="order-date-input bg-transparent border-none outline-none w-\[140px\] text-\[11px\] pl-2"/);
  assert.match(indexCss, /\.order-date-input\s*\{\s*color-scheme: inherit;/);
  assert.match(indexCss, /\.order-date-input::-webkit-calendar-picker-indicator\s*\{\s*display: none;/);
  assert.match(src, /aria-label="Select orders from date"/);
  assert.match(src, /aria-label="Select orders to date"/);
});

test('Orders filter dropdown arrows open the native picker and use tokenized theme colors', () => {
  assert.match(src, /const orderFilterSelectShellClassName = '.*cursor-pointer.*hover:bg-\[color:var\(--bg-surface-3\)\]/);
  assert.match(src, /const orderFilterSelectClassName = '.*text-\[color:var\(--text-primary\)\]';/);
  assert.match(src, /const orderFilterSelectOptionClassName = '.*bg-\[color:var\(--bg-surface-2\)\].*text-\[color:var\(--text-primary\)\]/);
  assert.match(src, /const orderFilterSelectOptionStyle = \{\s*backgroundColor: 'var\(--bg-surface-2\)',\s*color: 'var\(--text-primary\)'/);
  assert.match(src, /const handleOrderFilterSelectMouseDown = \(event\) => \{/);
  assert.match(src, /event\.target\?\.tagName === 'SELECT'/);
  assert.match(src, /event\.currentTarget\.querySelector\('select'\)/);
  assert.match(src, /select\.showPicker\(\)/);
  assert.match(src, /onMouseDown=\{handleOrderFilterSelectMouseDown\}/);
  assert.match(src, /className=\{orderFilterSelectOptionClassName\} style=\{orderFilterSelectOptionStyle\}/);
});

test('Open-only order filter does not hide filled live rows as closed history', () => {
  const closedStatusesBlock = src.match(/const CLOSED_ORDER_STATUSES = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? '';

  assert.doesNotMatch(closedStatusesBlock, /'filled'/);
  assert.match(closedStatusesBlock, /'closed'/);
  assert.match(closedStatusesBlock, /'cancelled'/);
  assert.match(src, /if \(filters\.openOnly && !isOpenOrderRow\(row\)\) return false/);
});

test('Orders display active rows as open instead of backend filled status in every order mode', () => {
  assert.match(src, /const getOrderDisplayStatus = \(row\) => \(/);
  assert.match(src, /isOpenOrderRow\(row\) \? 'open' : row\.status/);
  assert.match(src, /getOrderDisplayStatus\(row\)/);
  assert.match(src, /getOrderDisplayRow\(getOrderRow\(order, idx\)\)/);
});

test('Orders table uses shared paging instead of all-row render batches', () => {
  assert.match(src, /const DEFAULT_PAGE_SIZE = 100/);
  assert.match(src, /const PAGE_SIZE_OPTIONS = \[50, 100, 250\]/);
  assert.doesNotMatch(src, /ORDER_RENDER_BATCH_SIZE/);
  assert.doesNotMatch(src, /handleLoadMoreOrders/);
  assert.match(src, /const tableState = React\.useMemo\(\(\) => \{/);
  assert.match(src, /getPagedMappedRows\(\{\s*response:\s*ordersResponse,/);
  assert.match(src, /aria-label="Page number"/);
  assert.match(src, /aria-label="Rows per page"/);
  assert.match(src, /aria-label="Next page"/);
  assert.match(src, /paginationRangeLabel/);
});

test('Orders bottom tabs switch between open and all orders', () => {
  assert.match(src, /const handleOrderModeChange = \(mode\) => \{/);
  assert.match(src, /openOnly:\s*mode !== 'all'/);
  assert.match(src, /onClick=\{\(\) => handleOrderModeChange\('open'\)\}/);
  assert.match(src, /onClick=\{\(\) => handleOrderModeChange\('all'\)\}/);
  assert.match(src, /All Orders/);
});

test('Coming-soon views include the real Utency sidebar label', () => {
  const comingSoonBlock = src.match(/const COMING_SOON_VIEWS = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? '';

  assert.match(comingSoonBlock, /'Utency Matching Engine'/);
  assert.match(comingSoonBlock, /'Reports'/);
});
