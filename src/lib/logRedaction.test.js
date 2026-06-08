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
