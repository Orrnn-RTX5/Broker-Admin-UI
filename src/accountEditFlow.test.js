import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSrc = readFileSync(new URL('./AuthenticatedApp.jsx', import.meta.url), 'utf8');
const toolbarSrc = readFileSync(new URL('./components/organisms/ActionToolBar.jsx', import.meta.url), 'utf8');

test('row double-click edit routing is explicit by target type', () => {
  assert.match(appSrc, /const AccountEditPopup = React\.lazy\(\(\) => import\('\.\/components\/RIGHTCLICKJPOPUPS\/AccountEditPopup'\)\)/);
  assert.match(appSrc, /const TradeDetailsPopup = React\.lazy\(\(\) => import\('\.\/components\/RIGHTCLICKJPOPUPS\/TradeDetailsPopup'\)\)/);
  assert.match(appSrc, /const ACCOUNT_EDIT_VIEW_TYPES = new Set\(\['Clients', 'Trading Accounts'\]\)/);
  assert.match(appSrc, /const TRADE_DETAIL_VIEW_TYPES = new Set\(\['Orders', 'Positions', 'Deals'\]\)/);
  assert.match(appSrc, /if \(ACCOUNT_EDIT_VIEW_TYPES\.has\(viewType\)\) return 'account';/);
  assert.match(appSrc, /if \(TRADE_DETAIL_VIEW_TYPES\.has\(viewType\)\) return 'trade';/);
  assert.match(appSrc, /if \(viewType === 'Groups' && row\.iconType === 'group'\) return 'group';/);
  assert.doesNotMatch(appSrc, /setSelectedGroup\(group\);\s*setIsPopupOpen\(true\);/);
});

test('toolbar edit is driven by one selected edit target state', () => {
  assert.match(appSrc, /const \[selectedEditTarget, setSelectedEditTarget\] = React\.useState\(null\);/);
  assert.match(appSrc, /const canEditSelectedTarget =/);
  assert.match(appSrc, /openEditTarget\(selectedEditTarget\);/);
  assert.match(appSrc, /onEditClick=\{handleToolbarEdit\}/);
  assert.match(appSrc, /canEdit=\{canEditSelectedTarget\}/);
  assert.match(toolbarSrc, /onEditClick, canEdit = false/);
  assert.match(toolbarSrc, /<Tool\b(?=[^>]*\bicon=\{Pencil\})(?=[^>]*\bonClick=\{onEditClick\})(?=[^>]*\bdisabled=\{!canEdit\})[^>]*\/>/);
});

test('trade detail popup is mounted for order position and deal rows', () => {
  const popupSrc = readFileSync(new URL('./components/RIGHTCLICKJPOPUPS/TradeDetailsPopup.jsx', import.meta.url), 'utf8');

  assert.match(appSrc, /setViewingTrade\(\{ viewType: target\.viewType, row: target\.row \}\)/);
  assert.match(appSrc, /<TradeDetailsPopup\s+viewType=\{viewingTrade\.viewType\}\s+row=\{viewingTrade\.row\}/);
  assert.match(popupSrc, /Orders:\s*\[/);
  assert.match(popupSrc, /Positions:\s*\[/);
  assert.match(popupSrc, /Deals:\s*\[/);
  assert.doesNotMatch(popupSrc, /ManagerService|AccountsService/);
});

test('account editor saves through account update and existing status actions', () => {
  const popupSrc = readFileSync(new URL('./components/RIGHTCLICKJPOPUPS/AccountEditPopup.jsx', import.meta.url), 'utf8');

  assert.match(popupSrc, /AccountsService\.updateAccount\(login, profilePayload\)/);
  assert.match(popupSrc, /AccountsService\.activate\(login, form\.reason\)/);
  assert.match(popupSrc, /AccountsService\.suspend\(login, form\.reason\)/);
  assert.match(popupSrc, /AccountsService\.setReadonly\(login, form\.readOnly, form\.reason\)/);
  assert.match(popupSrc, /Balance:/);
  assert.match(popupSrc, /Equity:/);
});

test('account edit popup renders dash for empty or null equity and never submits equity in payload', () => {
  const popupSrc = readFileSync(new URL('./components/RIGHTCLICKJPOPUPS/AccountEditPopup.jsx', import.meta.url), 'utf8');
  assert.match(popupSrc, /equity:\s*pickDefined\(source,\s*\['equity',\s*'Equity'\],\s*row\?\.equity\s*\?\?\s*''\)/);
  assert.match(popupSrc, /<Field label="Equity:">\r?\n\s*<input value=\{form\.equity === '' \|\| form\.equity === null \|\| form\.equity === undefined \? '—' : form\.equity\} disabled/);
  assert.match(popupSrc, /balance:\s*pickDefined\(source,\s*\['balance',\s*'Balance'\],\s*row\?\.balance\s*\?\?\s*0\)/);
  assert.match(popupSrc, /const PROFILE_FIELDS = \['name', 'email', 'phone'\];/);
  assert.match(popupSrc, /const GUARDED_PROFILE_FIELDS = \['group', 'currency'\];/);
});
