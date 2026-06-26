import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildNavigationTarget, readAppPath, shouldUseHashRouting } from './routerPath.js';

test('web routing uses pathname routes', () => {
  const location = { protocol: 'https:', pathname: '/manager-login', hash: '' };

  assert.equal(shouldUseHashRouting(location), false);
  assert.equal(readAppPath(location), '/manager-login');
  assert.equal(buildNavigationTarget('/admin-login', location), '/admin-login');
});
test('packaged Electron file routing uses hash routes', () => {
  const location = {
    protocol: 'file:',
    pathname: '/C:/Program Files/RTX5 Broker Admin/resources/app.asar/dist/index.html',
    hash: '#/broker-manual-entry',
  };

  assert.equal(shouldUseHashRouting(location), true);
  assert.equal(readAppPath(location), '/broker-manual-entry');
  assert.equal(buildNavigationTarget('/manager-login', location), '#/manager-login');
});

test('packaged Electron defaults to the login route without using the file path', () => {
  const location = {
    protocol: 'file:',
    pathname: '/C:/Program Files/RTX5 Broker Admin/resources/app.asar/dist/index.html',
    hash: '',
  };

  assert.equal(readAppPath(location), '/');
});
