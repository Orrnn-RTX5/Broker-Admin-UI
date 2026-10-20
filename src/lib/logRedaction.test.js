import { test } from 'node:test';
import assert from 'node:assert/strict';

import { redactForLog, redactUrlForLog } from './logRedaction.js';

test('redactForLog redacts license key and license secret field names', () => {
  assert.deepEqual(
    redactForLog({
      license_key: 'raw-license',
      licenseKey: 'raw-license-camel',
      license_secret: 'raw-secret',
      nested: {
        licenceSecret: 'raw-uk-secret',
        safe: 'visible',
      },
    }),
    {
      license_key: '[REDACTED]',
      licenseKey: '[REDACTED]',
      license_secret: '[REDACTED]',
      nested: {
        licenceSecret: '[REDACTED]',
        safe: 'visible',
      },
    }
  );
});

test('redactForLog redacts the Idempotency-Key header value (SUI-A1 dev-log gap)', () => {
  assert.deepEqual(
    redactForLog({
      headers: {
        'Idempotency-Key': '123e4567-e89b-42d3-a456-426614174000',
        'Content-Type': 'application/json',
      },
    }),
    {
      headers: {
        'Idempotency-Key': '[REDACTED]',
        'Content-Type': 'application/json',
      },
    }
  );
});

test('redactUrlForLog redacts license query parameters', () => {
  assert.equal(
    redactUrlForLog('https://broker.example/validate?license_key=raw&broker_id=demo'),
    'https://broker.example/validate?license_key=[REDACTED]&broker_id=demo'
  );
  assert.equal(
    redactUrlForLog('/validate?licenseSecret=raw&broker_id=demo'),
    '/validate?licenseSecret=[REDACTED]&broker_id=demo'
  );
});

test('redactForLog caps large arrays before they reach the browser console', () => {
  const redacted = redactForLog({
    answer: Array.from({ length: 25 }, (_, index) => ({
      Login: index + 1,
      token: `secret-${index}`,
    })),
  });

  assert.equal(redacted.answer.length, 21);
  assert.deepEqual(redacted.answer[0], {
    Login: 1,
    token: '[REDACTED]',
  });
  assert.equal(redacted.answer[20], '[5 more items]');
});
