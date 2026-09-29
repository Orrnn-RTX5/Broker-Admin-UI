import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW_CAPABILITY_STATUS,
  getViewCapability,
  getViewCapabilityToast,
  shouldBlockViewNavigation,
} from './viewCapabilities.js';

test('working views do not show lock or warning toasts', () => {
  for (const viewName of [
    'Orders',
    'Time',
    'LP Routing',
    'Plugin Management',
    'Trading Accounts',
    'Analytics',
    'Exposure',
    'Risk Events',
    'Risk Limits',
    'Suspicious Activity',
    'Risk Reports',
    'Client Analytics',
    'Trading Analytics',
    'Trader Rankings',
    'Revenue Forecast',
    'Data Exports',
    'Regulatory Reports',
    'Complaints',
    'Auto Notification Rules',
    'Email Campaigns',
    'Message Center',
    'Push Notifications',
    'SMS',
    'Payment Methods',
    'Deposits',
    'Transaction History',
    'Spreads',
    'Feed Tenants',
    'Payments',
  ]) {
    assert.equal(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.WORKING);
    assert.equal(getViewCapabilityToast(viewName), null);
    assert.equal(shouldBlockViewNavigation(viewName), false);
  }
});

test('partial views warn but remain navigable', () => {
  for (const viewName of ['Positions', 'Deals', 'Gateways', 'Downstream access']) {
    assert.equal(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.PARTIAL);
    assert.equal(getViewCapabilityToast(viewName).tone, 'warning');
    assert.equal(shouldBlockViewNavigation(viewName), false);
  }
});

test('downstream access capability states the server gate and that saved access is not applied', () => {
  const { description } = getViewCapability('Downstream access');
  assert.match(description, /RTX5_C09_DOWNSTREAM_ADMIN_ENABLED=1/);
  assert.match(description, /Broker Admin only/);
  assert.match(description, /not applied, connected or verified/);
});

test('non-working options are locked behind an informational toast', () => {
  for (const viewName of [
    'Utency Matching Engine',
    'Data Feeds',
    'FCN',
    'Corporate links',
    'Platform Config',
    'Holidays',
    'Session Overrides',
    'Leverages',
    'Leverage Schedules',
    'Swap-Free Configs',
    'Network Cluster',
    'Providers',
    'Charts & Ticks',
    'Subscriptions',
    'Mailbox',
    'Live Update',
    'Withdrawals',
    'Payment Gateways',
    'Reconciliation',
    'Chargebacks',
  ]) {
    assert.equal(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.LOCKED_NO_API);
    assert.equal(getViewCapabilityToast(viewName).tone, 'info');
    assert.equal(shouldBlockViewNavigation(viewName), true);
  }
});

test('folder-only parent sections are informational and blocked from navigation', () => {
  for (const viewName of ['Risk Management', 'Communications']) {
    assert.equal(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.CONTAINER_ONLY);
    assert.equal(getViewCapabilityToast(viewName).tone, 'info');
    assert.equal(shouldBlockViewNavigation(viewName), true);
  }
});

test('api-present but not integrated options are locked without deleting the menu item', () => {
  for (const viewName of ['Reports', 'Funds & ETF', 'Routing', 'Plugins']) {
    assert.equal(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.API_AVAILABLE_NOT_INTEGRATED);
    assert.equal(getViewCapabilityToast(viewName).tone, 'info');
    assert.equal(shouldBlockViewNavigation(viewName), true);
  }
});

test('static pages warn but still open', () => {
  for (const viewName of ['Integrations', 'Automations', 'Security']) {
    assert.notEqual(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.WORKING);
    assert.ok(getViewCapabilityToast(viewName));
    assert.equal(shouldBlockViewNavigation(viewName), false);
  }
});
