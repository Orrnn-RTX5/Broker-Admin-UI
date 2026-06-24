import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW_CAPABILITY_STATUS,
  getViewCapability,
  getViewCapabilityToast,
  shouldBlockViewNavigation,
} from './viewCapabilities.js';

test('working views do not show lock or warning toasts', () => {
  for (const viewName of ['Orders', 'Time', 'LP Routing', 'Communications', 'Plugin Management']) {
    assert.equal(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.WORKING);
    assert.equal(getViewCapabilityToast(viewName), null);
    assert.equal(shouldBlockViewNavigation(viewName), false);
  }
});

test('partial views warn but remain navigable', () => {
  for (const viewName of ['Positions', 'Deals', 'Trading Accounts', 'Gateways', 'Feed Tenants']) {
    assert.equal(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.PARTIAL);
    assert.equal(getViewCapabilityToast(viewName).tone, 'warning');
    assert.equal(shouldBlockViewNavigation(viewName), false);
  }
});

test('non-working options are locked behind an informational toast', () => {
  for (const viewName of [
    'Utency Matching Engine',
    'Data Feeds',
    'FCN',
    'Corporate links',
    'Holidays',
    'Session Overrides',
    'Leverages',
    'Leverage Schedules',
    'Swap-Free Configs',
  ]) {
    assert.equal(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.LOCKED_NO_API);
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

test('static and container pages warn but still open', () => {
  for (const viewName of ['Integrations', 'Automations', 'Security', 'Payments', 'Providers']) {
    assert.notEqual(getViewCapability(viewName).status, VIEW_CAPABILITY_STATUS.WORKING);
    assert.ok(getViewCapabilityToast(viewName));
    assert.equal(shouldBlockViewNavigation(viewName), false);
  }
});
