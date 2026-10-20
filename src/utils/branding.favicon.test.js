import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBrokerBrandingToDocument,
  getBrokerBranding,
  resolveBrokerFaviconUrl,
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
  delete globalThis.document;
});

test('favicon stays empty with no broker config so the default HTML icon is kept', () => {
  assert.equal(resolveBrokerFaviconUrl(), '');
  assert.equal(getBrokerBranding().faviconUrl, '');
});

test('explicit runtime FAVICON_URL supplies the white-label favicon', () => {
  globalThis.window.__RTX5_RUNTIME_CONFIG__ = {
    FAVICON_URL: 'https://broker.example.com/favicon.ico',
  };

  assert.equal(
    resolveBrokerFaviconUrl(),
    'https://broker.example.com/favicon.ico'
  );
  assert.equal(
    getBrokerBranding().faviconUrl,
    'https://broker.example.com/favicon.ico'
  );
});

test('favicon falls back to the tenant logo endpoint when only broker identity is configured', () => {
  globalThis.window.__RTX5_RUNTIME_CONFIG__ = {
    BROKER_ID: 'acme-broker',
    DISCOVERY_BASE_URL: 'https://discovery.example.com',
  };

  const branding = getBrokerBranding();
  assert.equal(
    branding.faviconUrl,
    'https://discovery.example.com/api/v1/brokers/acme-broker/logo'
  );
  assert.equal(branding.faviconUrl, branding.logoUrl);
});

test('placeholder logo paths are ignored for the favicon', () => {
  globalThis.window.__RTX5_RUNTIME_CONFIG__ = {
    BROKER_ID: 'acme-broker',
    DISCOVERY_BASE_URL: 'https://discovery.example.com',
  };

  assert.equal(
    resolveBrokerFaviconUrl({ broker_id: 'acme-broker', logo_url: '/assets/logo.png' }),
    'https://discovery.example.com/api/v1/brokers/acme-broker/logo'
  );
});

test('applyBrokerBrandingToDocument sets title and favicon from tenant branding', () => {
  const links = [];
  globalThis.document = {
    title: 'Broker Admin',
    head: { appendChild: () => {} },
    querySelector: () => links[0] || null,
    createElement: () => ({
      setAttribute: (k, v) => { links[0] = links[0] || {}; links[0][k] = v; },
    }),
    getElementById: () => null,
  };
  const link = { href: 'default.ico', setAttribute(k, v) { this[k] = v; } };
  links[0] = link;

  const result = applyBrokerBrandingToDocument({
    appTitle: 'Acme Broker Admin',
    productName: 'Acme Broker Admin',
    logoUrl: '',
    faviconUrl: 'https://broker.example.com/favicon.ico',
  });

  assert.equal(globalThis.document.title, 'Acme Broker Admin');
  assert.equal(link.href, 'https://broker.example.com/favicon.ico');
  assert.equal(result.title, 'Acme Broker Admin');
});
