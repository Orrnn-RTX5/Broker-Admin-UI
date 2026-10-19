import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBrokerBranding,
  resolveBrokerLogoUrl,
  formatBrokerConnectionStatus,
} from './branding.js';

const createStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

beforeEach(() => {
  const session = createStorage();
  const local = createStorage();
  globalThis.sessionStorage = session;
  globalThis.localStorage = local;
  globalThis.window = {
    __RTX5_RUNTIME_CONFIG__: {},
    sessionStorage: session,
    localStorage: local,
  };
});

test('getBrokerBranding returns neutral white-label defaults when no broker is configured', () => {
  const branding = getBrokerBranding();

  assert.equal(branding.brokerId, '');
  assert.equal(branding.brokerName, '');
  assert.equal(branding.productName, 'Broker Admin');
  assert.equal(branding.appTitle, 'Broker Admin');
  assert.equal(branding.shortName, 'Broker Admin');
  assert.equal(branding.monogram, 'BA');
  assert.equal(branding.logoUrl, '');
  assert.equal(branding.supportEmail, 'support@example.com');
  assert.equal(branding.supportName, 'Support Center');
  assert.equal(branding.serverName, 'Trade Server');
});

test('getBrokerBranding derives Trivanta Markets branding and discovery logo URL from runtime config', () => {
  globalThis.window.__RTX5_RUNTIME_CONFIG__ = {
    BROKER_ID: 'trivanta-markets',
    DISCOVERY_BASE_URL: 'https://superadmin-prod.orrnn.com/',
    DEFAULT_MT5_SERVER: 'trivanta-live-01',
  };

  const branding = getBrokerBranding();

  assert.equal(branding.brokerId, 'trivanta-markets');
  assert.equal(branding.brokerName, 'Trivanta Markets');
  assert.equal(branding.productName, 'Trivanta Markets Admin');
  assert.equal(branding.appTitle, 'Trivanta Markets Admin');
  assert.equal(branding.monogram, 'TM');
  assert.equal(
    branding.logoUrl,
    'https://superadmin-prod.orrnn.com/api/v1/brokers/trivanta-markets/logo'
  );
  assert.equal(branding.serverName, 'trivanta-live-01');
});

test('resolveBrokerLogoUrl ignores legacy placeholder logo paths and derives broker logo endpoint', () => {
  globalThis.window.__RTX5_RUNTIME_CONFIG__ = {
    BROKER_ID: 'trivanta-markets',
    DISCOVERY_BASE_URL: 'https://superadmin-prod.orrnn.com',
  };

  assert.equal(
    resolveBrokerLogoUrl({
      broker_id: 'trivanta-markets',
      logo_url: '/assets/logo.png',
    }),
    'https://superadmin-prod.orrnn.com/api/v1/brokers/trivanta-markets/logo'
  );

  assert.equal(
    resolveBrokerLogoUrl({
      broker_id: 'trivanta-markets',
      logo_url: '/logo-full-light.webp',
    }),
    'https://superadmin-prod.orrnn.com/api/v1/brokers/trivanta-markets/logo'
  );
});

test('getBrokerBranding filters legacy placeholder support emails', () => {
  const branding = getBrokerBranding({
    broker_id: 'trivanta-markets',
    name: 'Trivanta Markets',
    support_email: 'support@rtx5.local',
  });

  assert.equal(branding.supportEmail, 'support@example.com');
  assert.equal(
    getBrokerBranding({
      broker_id: 'trivanta-markets',
      name: 'Trivanta Markets',
      support_email: 'help@trivantamarkets.com',
    }).supportEmail,
    'help@trivantamarkets.com'
  );
});

test('formatBrokerConnectionStatus reports live connection state against dynamic server name', () => {
  assert.equal(
    formatBrokerConnectionStatus({
      status: 'connected',
      broker: { server: 'trivanta-live-01' },
    }),
    'Connected to trivanta-live-01'
  );
  assert.equal(
    formatBrokerConnectionStatus({
      status: 'error',
      lastError: 'WebSocket closed',
      broker: { server: 'trivanta-live-01' },
    }),
    'Connection issue: WebSocket closed'
  );
});
