import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getViewCapability,
  hasReachableViewInSubtree,
  shouldBlockViewNavigation,
  VIEW_CAPABILITY_STATUS,
} from './viewCapabilities.js';
import { canAccessView, requiredPermissionForView } from '../utils/permissions.js';

// Session fixtures shaped like the user objects built from auth payloads
// (see utils/sessionUser.js). No fixture invents a permission: every key used
// below already exists in PERMISSION_KEYS.
const brokerAdmin = { role: 'admin', is_admin: true, permissions: ['*'] };
const paymentsManager = { role: 'manager', permissions: ['manage_payments'] };
const riskManager = { role: 'manager', permissions: ['risk_management'] };
const riskViewer = { role: 'manager', permissions: ['view_risk_events'] };
const serverAdmin = { role: 'manager', permissions: ['server_admin'] };
const commsManager = { role: 'manager', permissions: ['manage_communications'] };
const accountsOnly = { role: 'manager', permissions: ['view_accounts'] };
const emptyPerms = { role: 'manager', permissions: [] };

// Realistic folder shapes mirroring data/terminalData.jsx.
const riskFolder = {
  label: 'Risk Management',
  children: [
    { label: 'Exposure' },
    { label: 'Risk Events' },
    { label: 'Risk Limits' },
    { label: 'Suspicious Activity' },
    { label: 'Risk Reports' },
  ],
};
const platformFolder = {
  label: 'Platform Config',
  children: [
    { label: 'Custom Fields' },
    { label: 'Feature Flags' },
    { label: 'Symbol Visibility' },
    { label: 'Trading Terminal Config' },
  ],
};
const communicationsFolder = {
  label: 'Communications',
  children: [
    { label: 'Auto Notification Rules' },
    { label: 'Email Campaigns' },
    { label: 'Message Center' },
    { label: 'Push Notifications' },
    { label: 'SMS' },
  ],
};
const networkFolder = {
  label: 'Network Cluster',
  children: [{ label: 'Main Trade Server', children: [{ label: 'TradeProcessor SQL_E' }] }],
};
const supportFolder = {
  label: 'Support Center',
  children: [{ label: 'News' }, { label: 'Articles' }, { label: 'Service Desk' }],
};

test('SUI-A5: Withdrawals unlocks exactly for sessions granted manage_payments', () => {
  assert.equal(requiredPermissionForView('Withdrawals'), 'manage_payments');
  // Fail closed without a session.
  assert.equal(shouldBlockViewNavigation('Withdrawals'), true);
  assert.equal(shouldBlockViewNavigation('Withdrawals', null), true);
  assert.equal(shouldBlockViewNavigation('Withdrawals', undefined), true);
  // Unpermitted sessions stay locked.
  assert.equal(shouldBlockViewNavigation('Withdrawals', emptyPerms), true);
  assert.equal(shouldBlockViewNavigation('Withdrawals', accountsOnly), true);
  assert.equal(shouldBlockViewNavigation('Withdrawals', riskViewer), true);
  // Permitted sessions reach the view.
  assert.equal(shouldBlockViewNavigation('Withdrawals', paymentsManager), false);
  assert.equal(shouldBlockViewNavigation('Withdrawals', brokerAdmin), false);
});

test('SUI-A4: Symbol Visibility is capability-open and permission-gated to server_admin', () => {
  assert.equal(getViewCapability('Symbol Visibility').status, VIEW_CAPABILITY_STATUS.WORKING);
  assert.equal(shouldBlockViewNavigation('Symbol Visibility', accountsOnly), false);
  assert.equal(canAccessView(serverAdmin, 'Symbol Visibility'), true);
  assert.equal(canAccessView(brokerAdmin, 'Symbol Visibility'), true);
  assert.equal(canAccessView(accountsOnly, 'Symbol Visibility'), false);
  assert.equal(canAccessView(paymentsManager, 'Symbol Visibility'), false);
});

test('SUI-A4: Risk children stay navigable and are gated by risk permissions', () => {
  for (const viewName of ['Exposure', 'Risk Events', 'Risk Limits', 'Suspicious Activity', 'Risk Reports']) {
    assert.equal(shouldBlockViewNavigation(viewName, accountsOnly), false);
  }
  assert.equal(canAccessView(riskManager, 'Exposure'), true);
  assert.equal(canAccessView(riskViewer, 'Exposure'), false);
  assert.equal(canAccessView(riskViewer, 'Risk Events'), true);
  assert.equal(canAccessView(riskManager, 'Risk Events'), false);
  assert.equal(canAccessView(accountsOnly, 'Risk Limits'), false);
  assert.equal(canAccessView(brokerAdmin, 'Suspicious Activity'), true);
  assert.equal(canAccessView(paymentsManager, 'Withdrawals'), true);
  assert.equal(canAccessView(riskViewer, 'Withdrawals'), false);
});

test('SUI-A4: locked folders unlock exactly for sessions that can reach inside', () => {
  // Risk Management: risk sessions open it, unrelated sessions keep the lock.
  assert.equal(hasReachableViewInSubtree(riskFolder, riskManager), true);
  assert.equal(hasReachableViewInSubtree(riskFolder, riskViewer), true);
  assert.equal(hasReachableViewInSubtree(riskFolder, brokerAdmin), true);
  assert.equal(hasReachableViewInSubtree(riskFolder, accountsOnly), false);
  assert.equal(hasReachableViewInSubtree(riskFolder, paymentsManager), false);
  assert.equal(hasReachableViewInSubtree(riskFolder, emptyPerms), false);
  assert.equal(hasReachableViewInSubtree(riskFolder, undefined), false);
  assert.equal(hasReachableViewInSubtree(riskFolder, null), false);
  // Platform Config opens for server_admin (Symbol Visibility), not for others.
  assert.equal(hasReachableViewInSubtree(platformFolder, serverAdmin), true);
  assert.equal(hasReachableViewInSubtree(platformFolder, brokerAdmin), true);
  assert.equal(hasReachableViewInSubtree(platformFolder, paymentsManager), false);
  assert.equal(hasReachableViewInSubtree(platformFolder, accountsOnly), false);
  // Communications opens for manage_communications only.
  assert.equal(hasReachableViewInSubtree(communicationsFolder, commsManager), true);
  assert.equal(hasReachableViewInSubtree(communicationsFolder, brokerAdmin), true);
  assert.equal(hasReachableViewInSubtree(communicationsFolder, riskViewer), false);
  // Network Cluster is itself a permission-guarded view (server_admin).
  assert.equal(hasReachableViewInSubtree(networkFolder, serverAdmin), true);
  assert.equal(hasReachableViewInSubtree(networkFolder, brokerAdmin), true);
  assert.equal(hasReachableViewInSubtree(networkFolder, paymentsManager), false);
  // Support Center children carry no permission mapping, so no session unlocks
  // it on their own — it stays locked, even for the broker admin.
  assert.equal(hasReachableViewInSubtree(supportFolder, brokerAdmin), false);
  assert.equal(hasReachableViewInSubtree(supportFolder, accountsOnly), false);
});

test('SUI-A4/A5: locked views without a permission mapping stay blocked for everyone', () => {
  for (const viewName of ['Corporate links', 'FCN', 'Data Feeds', 'Utency Matching Engine']) {
    assert.equal(requiredPermissionForView(viewName), null);
    assert.equal(shouldBlockViewNavigation(viewName, brokerAdmin), true);
    assert.equal(shouldBlockViewNavigation(viewName, paymentsManager), true);
  }
  // Folder labels themselves remain non-navigable containers even when their
  // children unlock for a permitted session.
  assert.equal(shouldBlockViewNavigation('Risk Management', brokerAdmin), true);
  assert.equal(shouldBlockViewNavigation('Communications', brokerAdmin), true);
});
