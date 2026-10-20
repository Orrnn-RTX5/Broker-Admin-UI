// SUI-A4 folder unlock: labeled dropdown folders must be expandable by
// sessions that can reach a permission-guarded view inside them. TreeItem
// gates its chevron, row click and keyboard on
// Boolean(item.blockedNavigation || item.lockedDropdown || item.disabled),
// so an unlocked folder must NOT carry the label-level block — otherwise a
// permitted session sees behavior identical to pre-fix. These tests execute
// the real resolveFolderNavFlags decision helper and assert the composed
// TreeItem gate outcome for each fixture.
import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveFolderNavFlags } from '../../config/viewCapabilities.js';

// Session fixtures shaped like auth-payload users. Every permission key used
// already exists in PERMISSION_KEYS.
const brokerAdmin = { role: 'admin', is_admin: true, permissions: ['*'] };
const riskManager = { role: 'manager', permissions: ['risk_management'] };
const riskViewer = { role: 'manager', permissions: ['view_risk_events'] };
const commsManager = { role: 'manager', permissions: ['manage_communications'] };
const accountsOnly = { role: 'manager', permissions: ['view_accounts'] };

const riskFolder = {
  label: 'Risk Management',
  children: [
    { label: 'Exposure' },
    { label: 'Risk Events' },
    { label: 'Risk Limits' },
  ],
};
const communicationsFolder = {
  label: 'Communications',
  children: [{ label: 'Auto Notification Rules' }],
};
const supportFolder = {
  label: 'Support Center',
  children: [{ label: 'News' }, { label: 'Articles' }, { label: 'Service Desk' }],
};

// The exact gate TreeItem applies before handling chevron, row, keyboard.
const treeItemGateBlocks = (item) =>
  Boolean(item.blockedNavigation || item.lockedDropdown || item.disabled);

test('SUI-A4: permitted session unlocks the folder AND clears the label block', () => {
  const flags = resolveFolderNavFlags(riskFolder, riskManager);
  assert.equal(flags.lockedDropdown, false);
  assert.equal(flags.blockedNavigation, false);
  assert.equal(
    treeItemGateBlocks({ ...riskFolder, ...flags }),
    false,
    'permitted session must reach chevron, row click and keyboard'
  );
});

test('SUI-A4: broker admin unlocks folders with mapped children', () => {
  const adminFlags = resolveFolderNavFlags(communicationsFolder, brokerAdmin);
  assert.equal(adminFlags.lockedDropdown, false);
  assert.equal(adminFlags.blockedNavigation, false);
  const commsFlags = resolveFolderNavFlags(communicationsFolder, commsManager);
  assert.equal(commsFlags.lockedDropdown, false);
  assert.equal(commsFlags.blockedNavigation, false);
});

test('SUI-A4: unpermitted session keeps lock and block', () => {
  const flags = resolveFolderNavFlags(riskFolder, accountsOnly);
  assert.equal(flags.lockedDropdown, true);
  assert.equal(flags.blockedNavigation, true);
  assert.equal(treeItemGateBlocks({ ...riskFolder, ...flags }), true);
});

test('SUI-A4: folders fail closed without a session', () => {
  for (const user of [undefined, null]) {
    const flags = resolveFolderNavFlags(riskFolder, user);
    assert.equal(flags.lockedDropdown, true);
    assert.equal(flags.blockedNavigation, true);
  }
});

test('SUI-A4: risk viewer reaches Risk Events through the unlocked folder', () => {
  const flags = resolveFolderNavFlags(riskFolder, riskViewer);
  assert.equal(flags.lockedDropdown, false);
  assert.equal(flags.blockedNavigation, false);
});

test('SUI-A4: Support Center stays locked (no permission-mapped children yet)', () => {
  // News/Articles/Service Desk have no permission mapping, so no session
  // capability can grant them; the folder stays locked for everyone. This is
  // intended until Support Center gets capability-mapped views (A6 scope).
  // The lock is carried by lockedDropdown (the TreeItem gate still blocks),
  // since the label-level block only applies to mapped labels.
  const flags = resolveFolderNavFlags(supportFolder, brokerAdmin);
  assert.equal(flags.lockedDropdown, true);
  assert.equal(treeItemGateBlocks({ ...supportFolder, ...flags }), true);
});
