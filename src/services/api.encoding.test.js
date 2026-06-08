// Regression guard for admin-ui-F05 — query params built via raw template
// interpolation in services/api.js MUST be wrapped in encodeURIComponent so an
// attacker-/record-influenced value cannot smuggle extra query parameters
// (`&`, `#`, spaces) into the URL. This is a SOURCE-LEVEL guard (like
// App.tdz.test.js): services/api.js transitively imports lib/api.js which uses
// `import.meta.env`/`window`, so the module cannot be imported under plain
// `node --test`. We instead assert the real source text keeps every interpolated
// param encoded.
//
// Run with: node --test src/services/api.encoding.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'api.js'), 'utf8');

// Every helper that interpolates a single dynamic value into a query string.
// `name` is only for the assertion message; `re` matches the FIXED (encoded) form.
const ENCODED_PARAMS = [
  { name: 'getPositionHistory logins[]', re: /\/PositionHistoryMT4Format\?logins\[\]=\$\{encodeURIComponent\(loginId\)\}/ },
  { name: 'getOpenedOrders logins[]', re: /\/OpenedOrders\?logins\[\]=\$\{encodeURIComponent\(login\)\}/ },
  { name: 'ibGet login', re: /\/IBGet\?login=\$\{encodeURIComponent\(login\)\}/ },
  { name: 'ibClientList login', re: /\/IBClientList\?login=\$\{encodeURIComponent\(login\)\}/ },
  { name: 'ibClientListAll login', re: /\/IBClientListAll\?login=\$\{encodeURIComponent\(login\)\}/ },
  { name: 'ibPlanList login', re: /\/IBPlanList\?login=\$\{encodeURIComponent\(login\)\}/ },
  { name: 'ibTree login', re: /\/IBTree\?login=\$\{encodeURIComponent\(login\)\}/ },
  { name: 'sessionOverrideDelete override_id', re: /\/SessionOverrideDelete\?override_id=\$\{encodeURIComponent\(overrideId\)\}/ },
  { name: 'dynamicLeverageDelete tier_id', re: /\/DynamicLeverageDelete\?tier_id=\$\{encodeURIComponent\(tierId\)\}/ },
  { name: 'commissionScheduleDelete schedule_id', re: /\/CommissionScheduleDelete\?schedule_id=\$\{encodeURIComponent\(scheduleId\)\}/ },
  { name: 'swapFreeGroupDelete group_id', re: /\/SwapFreeGroupDelete\?group_id=\$\{encodeURIComponent\(groupId\)\}/ },
];

for (const { name, re } of ENCODED_PARAMS) {
  test(`api.js encodes query param: ${name}`, () => {
    assert.ok(re.test(src), `${name} must interpolate via encodeURIComponent (admin-ui-F05)`);
  });
}

// Belt-and-suspenders: no helper should interpolate a bare identifier straight
// into a query value (i.e. `=${ident}` with no encodeURIComponent/URLSearchParams
// wrapper). This catches a NEW unencoded param being added later.
test('api.js has no raw ${ident} query interpolation', () => {
  // Match `=${something}` where `something` is a simple identifier (no call).
  const rawParam = /=\$\{\s*[A-Za-z_$][\w$]*\s*\}/g;
  const offenders = src.match(rawParam) || [];
  assert.deepEqual(
    offenders,
    [],
    `unencoded query interpolation(s) found: ${offenders.join(', ')} (admin-ui-F05)`
  );
});
