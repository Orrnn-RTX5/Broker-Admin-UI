// Source-level guard for the G8/G9/G23 admin editors (expected revision,
// lock/conflict display, account creation under a group, ledger funding).
// Run with: node --test src/components/RIGHTCLICKJPOPUPS/legacyConfigEditors.source.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const accountEdit = read('./AccountEditPopup.jsx');
const groupProps = read('./GroupPropertiesPopup.jsx');
const create = read('./AccountCreatePopup.jsx');
const funding = read('./FundingPopup.jsx');
const accountsService = read('../../services/accounts.service.js');

test('account editor: leverage and account mode through the guarded PATCH with the revision', () => {
  assert.match(accountEdit, /AdminConfigApi\.getAccountConfig\(login\)/);
  assert.match(accountEdit, /AdminConfigApi\.updateAccountTrading\(login, guardedPayload, config\.revision, form\.reason\)/);
  assert.match(accountEdit, /const GUARDED_PROFILE_FIELDS = \['group', 'currency'\];/);
  assert.match(accountEdit, /const PROFILE_FIELDS = \['name', 'email', 'phone'\];/);
  assert.match(accountEdit, /aria-label="Leverage"/);
  assert.match(accountEdit, /aria-label="Account mode"/);
  assert.match(accountEdit, /ACCOUNT_MODE_OPTIONS\.map/);
  // Lock and conflict errors are shown precisely; a conflict reloads the config.
  assert.match(accountEdit, /setLockDetails\(parsed\.lockDetails\)/);
  assert.match(accountEdit, /if \(parsed\.kind === 'conflict'\) reloadConfig\(\)/);
  // A5's trade controls stay mounted.
  assert.match(accountEdit, /<AccountTradeControls key=\{login\} login=\{login\} \/>/);
  assert.match(accountEdit, /<PendingTradeControls key=\{'pending-'\+login\} login=\{login\} \/>/);
});

test('funding: ledger request workflow only, no direct balance edit', () => {
  assert.match(accountEdit, /<FundingPopup login=\{login\}/);
  assert.match(funding, /AdminConfigApi\.requestFunding\(kind, payload\)/);
  assert.match(funding, /buildFundingRequest\(kind, login, form\)/);
  assert.doesNotMatch(funding, /AccountsService|\/deposit`|\/withdraw`|transactions\//);
  assert.match(accountsService, /@deprecated Use AdminConfigApi\.requestFunding\('deposit'/);
});

test('group properties: revisions, leverage, lock/conflict text and account creation', () => {
  assert.match(groupProps, /ManagerService\.getGroup\(currentGroupName\)/);
  assert.match(groupProps, /setSymbolsRevision\(readRevision\(response\)\)/);
  assert.match(groupProps, /id="group-leverage"/);
  assert.match(groupProps, /marginChanges = \{ \.\.\.changes, \.\.\.leverageChange\.changes \};/);
  assert.match(groupProps, /const reason = describeConfigError\(error, 'request failed\.'\);/);
  // A GroupUpdate revision conflict reloads the group and its revision, keeps
  // the admin's edits (rebased) and asks for a fresh OK; it never re-sends.
  assert.match(groupProps, /let failedTab = 'Margin';/);
  assert.match(groupProps, /setActiveTab\(failedTab\);\s*if \(failedTab === 'Margin' && readConfigError\(error\)\.kind === 'conflict'\) \{\s*setSaveError\(await reloadGroupAfterConflict\(reason\)\);/);
  // Later symbol failures stay on their own tab and retain the successful
  // margin save summary instead of being mistaken for a margin conflict.
  assert.match(groupProps, /if \(symbolsDirty\) \{\s*failedTab = 'Symbol List';/);
  assert.match(groupProps, /if \(overridesDirty\) \{\s*failedTab = 'Symbols';/);
  assert.match(groupProps, /setSaveError\(summary\.length > 0\s*\? `\$\{summary\.join\(' '\)\} But saving the \$\{what\} failed: \$\{reason\}`\s*: `Failed to save \$\{what\}: \$\{reason\}`\);/);
  const reload = groupProps.slice(groupProps.indexOf('const reloadGroupAfterConflict'), groupProps.indexOf('const handleOk'));
  assert.match(reload, /ManagerService\.getGroup\(currentGroupName\)/);
  assert.match(reload, /setGroupRevision\(revision\)/);
  assert.match(reload, /rebaseMarginForm\(initialMargin, current, freshMargin\)/);
  assert.match(reload, /review the current values and your edits, then press OK again/);
  assert.doesNotMatch(reload, /updateGroup|handleOk\(/, 'the reload never re-submits');
  assert.match(groupProps, /<AccountCreatePopup\s+group=\{currentGroupName\}/);
  assert.match(groupProps, /defaultCurrency=\{initialCurrency\}/);
  assert.match(create, /AdminConfigApi\.createCustomerAccount\(payload\)/);
  assert.match(create, /buildAccountCreatePayload\(form,/);
  // Account creation inherits the live group: no hardcoded currency/leverage.
  assert.match(create, /readGroupCurrency/);
  assert.match(create, /readGroupLeverage/);
  assert.doesNotMatch(create, /'USD'|"USD"|`USD`/);
  assert.doesNotMatch(create, /demo\\forex|forex-hedge/i);
  // No "created" state or success toast unless the reply names the new login.
  assert.match(create, /const login = readCreatedLogin\(result\);\s*if \(!login\) \{/);
  assert.match(create, /<FundingPopup login=\{created\.login\}/);
  assert.doesNotMatch(create, /Credit|Balance:/);
});

test('account create wizard: netting option disabled and submit refuses it before the request', () => {
  assert.match(create, /ACCOUNT_MODE_CREATE_OPTIONS\.map/);
  assert.match(create, /disabled=\{option\.disabled\}/);
  assert.doesNotMatch(create, /ACCOUNT_MODE_OPTIONS\.map/);
  assert.match(create, /const \{ payload, errors: nextErrors \} = buildAccountCreatePayload\(form, groupContext\);\s*if \(!payload\) \{\s*setErrors\(nextErrors\);\s*return;/);
});
